package luckydraw

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

func (h *Handler) ListCampaigns(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	campaigns, total, err := h.svc.ListCampaigns(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": campaigns, "total": total})
}

func (h *Handler) ListActiveCampaigns(c *gin.Context) {
	tenantID := c.GetString("tenant_id")

	campaigns, err := h.svc.ListActiveCampaigns(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": campaigns})
}

func (h *Handler) GetCampaign(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	campaign, prizes, err := h.svc.GetCampaign(c.Request.Context(), tenantID, id)
	if err != nil {
		apperror.RespondNotFound(c, "not_found")
		return
	}
	c.JSON(http.StatusOK, gin.H{"campaign": campaign, "prizes": prizes})
}

func (h *Handler) CreateCampaign(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	var input CreateCampaignInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.Respond(c, err)
		return
	}
	input.TenantID = tenantID

	campaign, err := h.svc.CreateCampaign(c.Request.Context(), input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, campaign)
}

func (h *Handler) UpdateCampaign(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	var input UpdateCampaignInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.Respond(c, err)
		return
	}

	campaign, err := h.svc.UpdateCampaign(c.Request.Context(), tenantID, id, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, campaign)
}

func (h *Handler) AddPrize(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	campaignID := c.Param("id")

	var input CreatePrizeInput
	if err := c.ShouldBindJSON(&input); err != nil {
		apperror.Respond(c, err)
		return
	}

	prize, err := h.svc.AddPrize(c.Request.Context(), tenantID, campaignID, input)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, prize)
}

func (h *Handler) DeletePrize(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	prizeID := c.Param("prizeId")

	if err := h.svc.DeletePrize(c.Request.Context(), tenantID, prizeID); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

func (h *Handler) Register(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	campaignID := c.Param("id")
	userID := c.GetString("user_id")

	ticket, err := h.svc.Register(c.Request.Context(), tenantID, campaignID, userID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusCreated, ticket)
}

func (h *Handler) GetUserTickets(c *gin.Context) {
	campaignID := c.Param("id")
	userID := c.GetString("user_id")

	tickets, err := h.svc.GetUserTickets(c.Request.Context(), campaignID, userID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tickets})
}

func (h *Handler) GetAllUserTickets(c *gin.Context) {
	userID := c.GetString("user_id")

	tickets, err := h.svc.GetAllUserTickets(c.Request.Context(), userID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": tickets})
}

func (h *Handler) DrawWinners(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	campaignID := c.Param("id")

	winners, err := h.svc.DrawWinners(c.Request.Context(), tenantID, campaignID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": winners})
}

func (h *Handler) GetWinners(c *gin.Context) {
	campaignID := c.Param("id")

	winners, err := h.svc.GetWinners(c.Request.Context(), campaignID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": winners})
}
