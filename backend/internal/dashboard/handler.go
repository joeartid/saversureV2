package dashboard

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"saversure/internal/apperror"
)

type Handler struct {
	svc *Service
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{svc: NewService(db)}
}

func (h *Handler) Summary(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	summary, err := h.svc.GetSummary(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, summary)
}

func (h *Handler) ScanChart(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	groupBy := c.DefaultQuery("group_by", "day")
	days := 30
	if groupBy == "week" {
		days = 90
	} else if groupBy == "month" {
		days = 365
	}

	data, err := h.svc.GetScanChart(c.Request.Context(), tenantID, groupBy, days)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data, "group_by": groupBy})
}

func (h *Handler) TopProducts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	products, err := h.svc.GetTopProducts(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": products})
}

func (h *Handler) ConversionFunnel(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	data, err := h.svc.GetConversionFunnel(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *Handler) GeoHeatmap(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	points, err := h.svc.GetGeoHeatmap(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": points})
}

func (h *Handler) RecentActivity(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if limit <= 0 {
		limit = 20
	}

	activities, err := h.svc.GetRecentActivity(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": activities})
}

func (h *Handler) RFMDistribution(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetRFMDistribution(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CustomerCohorts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	items, err := h.svc.GetCustomerCohorts(c.Request.Context(), tenantID)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CRMTopProducts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	period := c.DefaultQuery("period", "30d")
	items, err := h.svc.GetTopProductsByPeriod(c.Request.Context(), tenantID, period, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "period": period})
}

func (h *Handler) TopRewards(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	period := c.DefaultQuery("period", "30d")
	items, err := h.svc.GetTopRewards(c.Request.Context(), tenantID, period, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items, "period": period})
}

func (h *Handler) RefreshCustomerCohorts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.RefreshCustomerCohorts(c.Request.Context(), tenantID); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "customer cohorts refreshed"})
}

func (h *Handler) ProductAffinities(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	items, err := h.svc.GetProductAffinities(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) CLVOverview(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	item, err := h.svc.GetCLVOverview(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, item)
}

func (h *Handler) CampaignROI(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	items, err := h.svc.GetCampaignROI(c.Request.Context(), tenantID, limit)
	if err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": items})
}

func (h *Handler) RefreshAdvancedCRM(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	if err := h.svc.RefreshAdvancedCRMAnalytics(c.Request.Context(), tenantID); err != nil {
		apperror.Respond(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "advanced crm analytics refreshed"})
}
