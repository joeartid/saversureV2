package v1sync

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

type triggerRequest struct {
	Entities []string `json:"entities"`
	Limit    int      `json:"limit"`
}

func (h *Handler) Trigger(c *gin.Context) {
	var req triggerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req = triggerRequest{}
	}

	if !h.svc.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "V1 live database not configured. Set V1_LIVE_DB_HOST and V1_LIVE_DB_USER.",
		})
		return
	}

	results := h.svc.RunSync(c.Request.Context(), req.Entities, req.Limit)

	hasError := false
	for _, r := range results {
		if r.Error != "" {
			hasError = true
			break
		}
	}

	status := http.StatusOK
	if hasError {
		status = http.StatusPartialContent
	}
	c.JSON(status, gin.H{"results": results})
}

func (h *Handler) Status(c *gin.Context) {
	statuses, err := h.svc.GetStatus(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"configured": h.svc.IsConfigured(),
		"entities":   statuses,
	})
}

func (h *Handler) Health(c *gin.Context) {
	forceRefresh := c.Query("refresh") == "1"
	var (
		report *HealthReport
		err    error
	)
	if forceRefresh {
		report, err = h.svc.GetHealthFresh(c.Request.Context())
	} else {
		report, err = h.svc.GetHealth(c.Request.Context())
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}
