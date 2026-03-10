package code

import (
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Lookup(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "code query parameter is required"})
		return
	}
	result, err := h.svc.Lookup(c.Request.Context(), c.GetString("tenant_id"), code)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "lookup_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ResolveRef1(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "code query parameter is required"})
		return
	}
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		tenantID = c.GetHeader("X-Tenant-ID")
	}
	if tenantID == "" {
		tid, err := h.svc.ResolveTenantFromCode(c.Request.Context(), code)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "Code not found"})
			return
		}
		tenantID = tid
	}
	result, err := h.svc.ResolveRef1(c.Request.Context(), tenantID, code)
	if err != nil {
		if errors.Is(err, ErrInvalidCode) || errors.Is(err, ErrBatchNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": "Code not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "resolve_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ResolveRedirect(c *gin.Context) {
	code := c.Param("code")
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_code"})
		return
	}

	tenantID, err := h.svc.ResolveTenantFromCode(c.Request.Context(), code)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "code_not_found", "message": "This code does not match any brand"})
		return
	}

	var slug string
	err = h.svc.db.QueryRow(c.Request.Context(),
		`SELECT slug FROM tenants WHERE id = $1`, tenantID,
	).Scan(&slug)
	if err != nil || slug == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant_not_found"})
		return
	}

	redirectURL := fmt.Sprintf("https://%s.svsu.me/s/%s", slug, code)
	c.Redirect(http.StatusFound, redirectURL)
}

// ResolveRedirectV2 handles qr.svsu.me/{shortcode}/{ref1} as a NoRoute fallback.
// Parses path like "/jh/A6FPZKTQL6" → shortcode="jh", ref1="A6FPZKTQL6"
func (h *Handler) ResolveRedirectV2(c *gin.Context) {
	path := strings.TrimPrefix(c.Request.URL.Path, "/")
	parts := strings.SplitN(path, "/", 3)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	shortcode := strings.ToLower(parts[0])
	ref1 := parts[1]

	var slug string
	err := h.svc.db.QueryRow(c.Request.Context(),
		`SELECT slug FROM tenants WHERE shortcode = $1 AND status = 'active'`, shortcode,
	).Scan(&slug)
	if err != nil || slug == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	redirectURL := fmt.Sprintf("https://%s.svsu.me/s/%s", slug, ref1)
	c.Redirect(http.StatusFound, redirectURL)
}

func (h *Handler) Scan(c *gin.Context) {
	var input ScanInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}
	if input.Code == "" && input.Ref1 == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "Either code or ref1 is required"})
		return
	}
	if input.Code != "" && input.Ref1 != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": "Provide either code or ref1, not both"})
		return
	}

	result, err := h.svc.Scan(c.Request.Context(), c.GetString("tenant_id"), c.GetString("user_id"), input)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidCode):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_code", "message": "This QR code is not valid"})
		case errors.Is(err, ErrCodeUsed):
			c.JSON(http.StatusConflict, gin.H{"error": "code_used", "message": "This code has already been used"})
		case errors.Is(err, ErrBatchRecalled):
			c.JSON(http.StatusGone, gin.H{"error": "batch_recalled", "message": "This code is no longer valid"})
		case errors.Is(err, ErrBatchNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "code_not_found", "message": "Code does not belong to any active campaign"})
		case errors.Is(err, ErrDailyQuotaExceeded):
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "quota_exceeded", "message": "Daily scan quota exceeded"})
		case errors.Is(err, ErrCodeWasted):
			c.JSON(http.StatusGone, gin.H{"error": "code_wasted", "message": "This code was reported as wasted during production"})
		case errors.Is(err, ErrRollNotReady):
			c.JSON(http.StatusPreconditionFailed, gin.H{"error": "roll_not_ready", "message": "Roll has not passed QC"})
		case errors.Is(err, ErrProfileIncomplete):
			c.JSON(http.StatusForbidden, gin.H{"error": "profile_incomplete", "message": "กรุณาลงทะเบียนสมาชิกก่อน"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "scan_failed", "message": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, result)
}
