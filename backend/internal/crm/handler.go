package crm

import (
	"net/http"
	"strconv"

	"saversure/internal/apperror"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
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

func (h *Handler) ListTriggers(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListTriggers(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input TriggerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.CreateTrigger(c.Request.Context(), tenantID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	triggerID := c.Param("id")
	var input TriggerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.UpdateTrigger(c.Request.Context(), tenantID, triggerID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteTrigger(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	triggerID := c.Param("id")
	if err := h.svc.DeleteTrigger(c.Request.Context(), tenantID, triggerID); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) RunAutomation(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.RunLifecycleAutomation(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *Handler) ListSurveys(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.ListSurveys(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateSurvey(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input SurveyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.CreateSurvey(c.Request.Context(), tenantID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) UpdateSurvey(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	surveyID := c.Param("id")
	var input SurveyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.UpdateSurvey(c.Request.Context(), tenantID, surveyID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) DeleteSurvey(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	surveyID := c.Param("id")
	if err := h.svc.DeleteSurvey(c.Request.Context(), tenantID, surveyID); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) ListSurveyResponses(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	surveyID := c.Param("id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	items, err := h.svc.ListSurveyResponses(c.Request.Context(), tenantID, surveyID, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) ListReferralCodes(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	items, err := h.svc.ListReferralCodes(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateReferralCode(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input ReferralCodeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.CreateReferralCode(c.Request.Context(), tenantID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) ListReferralHistory(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	items, err := h.svc.ListReferralHistory(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) ListMySurveys(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	triggerEvent := c.Query("trigger_event")
	items, err := h.svc.ListMySurveys(c.Request.Context(), tenantID, userID, triggerEvent)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) SubmitMySurveyResponse(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	surveyID := c.Param("id")
	var input SurveyResponseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	if err := h.svc.SubmitSurveyResponse(c.Request.Context(), tenantID, userID, surveyID, input); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "submitted"})
}

func (h *Handler) GetMyReferralCode(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	item, err := h.svc.GetMyReferralCode(c.Request.Context(), tenantID, userID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) ApplyMyReferralCode(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	var input ReferralApplyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	if err := h.svc.ApplyReferralCode(c.Request.Context(), tenantID, userID, input); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "applied"})
}

func (h *Handler) ListSegmentExports(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	items, err := h.svc.ListSegmentExports(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CreateSegmentExport(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	actorID := c.GetString("user_id")
	var input CreateSegmentExportInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.RespondValidation(c, err.Error())
		return
	}
	item, err := h.svc.CreateSegmentExport(c.Request.Context(), tenantID, actorID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, item)
}

func (h *Handler) RunSegmentExportsNow(c *gin.Context) {
	if err := h.svc.RunSegmentExportsNow(c.Request.Context()); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "segment exports processed"})
}

func (h *Handler) GetSurveyInsights(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	item, err := h.svc.GetSurveyInsights(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) GetReferralOverview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	item, err := h.svc.GetReferralOverview(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) GetMyReferralOverview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	item, err := h.svc.GetMyReferralOverview(c.Request.Context(), tenantID, userID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}
