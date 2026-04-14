package crm

import (
	"net/http"
	"strconv"

	"saversure/internal/apperror"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc *Service
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{svc: NewService(db)}
}

type replaceCustomerTagsInput struct {
	TagIDs []string `json:"tag_ids"`
}

func (h *Handler) ListTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListTags(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input TagInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.CreateTag(c.Request.Context(), tenantID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var input TagInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.UpdateTag(c.Request.Context(), tenantID, id, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteTag(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteTag(c.Request.Context(), tenantID, id); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) ListCustomerTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("userId")
	items, err := h.svc.ListCustomerTags(c.Request.Context(), tenantID, userID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) ReplaceCustomerTags(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.Param("userId")
	var input replaceCustomerTagsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	if err := h.svc.ReplaceCustomerTags(c.Request.Context(), tenantID, userID, input.TagIDs); err != nil {
		apperror.Respond(c, err)
		return
	}
	items, err := h.svc.ListCustomerTags(c.Request.Context(), tenantID, userID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) ListSegments(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListSegments(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateSegment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input SegmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.CreateSegment(c.Request.Context(), tenantID, userID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateSegment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	var input SegmentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.UpdateSegment(c.Request.Context(), tenantID, id, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteSegment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	if err := h.svc.DeleteSegment(c.Request.Context(), tenantID, id); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) PreviewSegment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, total, err := h.svc.PreviewSegment(c.Request.Context(), tenantID, id, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *Handler) RefreshSegment(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")
	count, err := h.svc.RefreshSegment(c.Request.Context(), tenantID, id)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"cached_count": count})
}

func (h *Handler) ListRFMSnapshots(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	riskLevel := c.Query("risk_level")
	items, total, err := h.svc.ListRFMSnapshots(c.Request.Context(), tenantID, riskLevel, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "total": total})
}

func (h *Handler) GetRFMDistribution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetRFMDistribution(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) RefreshRFM(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.RefreshRFMSnapshots(c.Request.Context(), tenantID); err != nil {
		apperror.Respond(c, err)
		return
	}
	if err := h.svc.TouchSegmentCaches(c.Request.Context(), tenantID); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "rfm refreshed"})
}

func (h *Handler) PreviewBroadcast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input BroadcastPreviewInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.PreviewBroadcast(c.Request.Context(), tenantID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) CreateBroadcast(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input BroadcastCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.CreateBroadcastCampaign(c.Request.Context(), tenantID, userID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) ListBroadcasts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListBroadcastCampaigns(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}
