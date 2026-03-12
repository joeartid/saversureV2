package migrationjob

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetSourceConfig(c *gin.Context) {
	c.JSON(http.StatusOK, h.svc.GetSourceConfig())
}

func (h *Handler) Create(c *gin.Context) {
	var input CreateJobInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}
	job, err := h.svc.CreateJob(c.Request.Context(), c.GetString("tenant_id"), c.GetString("user_id"), input)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "create_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, job)
}

func (h *Handler) List(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, total, err := h.svc.ListJobs(c.Request.Context(), c.GetString("tenant_id"), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *Handler) Get(c *gin.Context) {
	job, err := h.svc.GetJobDetail(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, job)
}

func (h *Handler) Errors(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListErrors(c.Request.Context(), c.GetString("tenant_id"), c.Param("id"), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) Cancel(c *gin.Context) {
	if err := h.svc.CancelJob(c.Request.Context(), c.GetString("tenant_id"), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "cancel_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "cancel_requested"})
}

func (h *Handler) Retry(c *gin.Context) {
	job, err := h.svc.RetryJob(c.Request.Context(), c.GetString("tenant_id"), c.GetString("user_id"), c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "retry_failed", "message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, job)
}
