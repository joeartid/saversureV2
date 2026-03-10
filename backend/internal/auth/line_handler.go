package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"

	"github.com/gin-gonic/gin"
)

type LINEHandler struct {
	svc *LINEService
}

func NewLINEHandler(svc *LINEService) *LINEHandler {
	return &LINEHandler{svc: svc}
}

func (h *LINEHandler) GetAuthURL(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	redirectCode := c.Query("redirect_code")

	b := make([]byte, 16)
	_, _ = rand.Read(b)
	state := hex.EncodeToString(b)
	if redirectCode != "" {
		state = state + "|" + redirectCode
	}

	var authURL string
	if tenantID != "" {
		if !h.svc.IsConfiguredForTenant(c.Request.Context(), tenantID) {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "line_not_configured", "message": "LINE Login is not configured for this tenant"})
			return
		}
		authURL = h.svc.AuthorizationURLForTenant(c.Request.Context(), tenantID, state)
	} else {
		if !h.svc.IsConfigured() {
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "line_not_configured", "message": "LINE Login is not configured"})
			return
		}
		authURL = h.svc.AuthorizationURL(state)
	}

	c.JSON(http.StatusOK, gin.H{
		"url":   authURL,
		"state": state,
	})
}

func (h *LINEHandler) Callback(c *gin.Context) {
	if !h.svc.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "line_not_configured"})
		return
	}

	var input struct {
		Code     string `json:"code" binding:"required"`
		TenantID string `json:"tenant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.LoginOrRegister(c.Request.Context(), input.TenantID, input.Code, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "line_login_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// LIFFLogin accepts a LIFF access_token directly (no OAuth code exchange needed).
func (h *LINEHandler) LIFFLogin(c *gin.Context) {
	var input struct {
		AccessToken string `json:"access_token" binding:"required"`
		TenantID    string `json:"tenant_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.LoginOrRegisterWithToken(c.Request.Context(), input.TenantID, input.AccessToken, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "liff_login_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// GetLIFFID returns the LIFF ID configured for the tenant (public, no auth).
// Accepts tenant_id via query param or context (set by JWT/tenant middleware).
func (h *LINEHandler) GetLIFFID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.Query("tenant_id")
	}
	if tenantID == "" {
		// Resolve from shortcode query param
		shortcode := c.Query("shortcode")
		if shortcode != "" {
			_ = h.svc.db.QueryRow(c.Request.Context(),
				`SELECT id FROM tenants WHERE shortcode = $1 AND status = 'active'`, shortcode,
			).Scan(&tenantID)
		}
	}
	liffID := h.svc.LIFFIDForTenant(c.Request.Context(), tenantID)
	c.JSON(http.StatusOK, gin.H{"liff_id": liffID})
}
