package scanhistory

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	svc *Service
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{svc: NewService(db)}
}

func (h *Handler) List(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	status := c.Query("status")
	scanType := c.Query("scan_type") // success, duplicate_self, duplicate_other
	batchID := c.Query("batch_id")
	codeID := c.Query("code_id")   // by-code view: all scan attempts for one code
	sortBy := c.Query("sort_by")   // column key (see allowedSortColumns)
	sortDir := c.Query("sort_dir") // asc | desc

	entries, total, err := h.svc.List(c.Request.Context(), tenantID, ListFilter{
		Status:   status,
		ScanType: scanType,
		BatchID:  batchID,
		CodeID:   codeID,
		SortBy:   sortBy,
		SortDir:  sortDir,
		Limit:    limit,
		Offset:   offset,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": entries, "total": total})
}

// GetAlerts returns codes with duplicate scans (suspicious / for monitoring).
func (h *Handler) GetAlerts(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	list, err := h.svc.ListSuspicious(c.Request.Context(), tenantID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": list})
}

func (h *Handler) GetByID(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	id := c.Param("id")

	entry, err := h.svc.GetByID(c.Request.Context(), tenantID, id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, entry)
}
