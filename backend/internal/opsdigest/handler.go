package opsdigest

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"saversure/internal/apperror"
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

	forceRefresh := c.Query("refresh") == "1"
	var (
		digest *DigestSummary
		err    error
	)
	if forceRefresh {
		digest, err = h.svc.GenerateDigestFresh(c.Request.Context(), tenantID)
	} else {
		digest, err = h.svc.GenerateDigest(c.Request.Context(), tenantID)
	}
	if err != nil {
		apperror.Respond(c, err)
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

	forceRefresh := c.Query("refresh") == "1"
	var (
		digest *DigestSummary
		err    error
	)
	if forceRefresh {
		digest, err = h.svc.GenerateDigestFresh(c.Request.Context(), tenantID)
	} else {
		digest, err = h.svc.GenerateDigest(c.Request.Context(), tenantID)
	}
	if err != nil {
		apperror.Respond(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alerts": digest.Alerts,
		"count":  len(digest.Alerts),
	})
}
