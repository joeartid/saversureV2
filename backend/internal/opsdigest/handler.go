package opsdigest

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetDigest(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_tenant"})
		return
	}

	digest, err := h.svc.GenerateDigest(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "digest_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, digest)
}

func (h *Handler) GetAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if tenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing_tenant"})
		return
	}

	digest, err := h.svc.GenerateDigest(c.Request.Context(), tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "alerts_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": digest.Alerts,
		"count":  len(digest.Alerts),
	})
}
