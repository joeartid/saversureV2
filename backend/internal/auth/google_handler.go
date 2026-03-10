package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type GoogleHandler struct {
	svc *GoogleService
}

func NewGoogleHandler(svc *GoogleService) *GoogleHandler {
	return &GoogleHandler{svc: svc}
}

func (h *GoogleHandler) GetConfig(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	clientID := h.svc.ClientIDForTenant(c.Request.Context(), tenantID)
	c.JSON(http.StatusOK, gin.H{
		"client_id": clientID,
		"enabled":   clientID != "",
	})
}

func (h *GoogleHandler) Login(c *gin.Context) {
	var input struct {
		TenantID string `json:"tenant_id" binding:"required"`
		IDToken  string `json:"id_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.LoginOrRegister(c.Request.Context(), input.TenantID, input.IDToken, c.ClientIP())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "google_login_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}
