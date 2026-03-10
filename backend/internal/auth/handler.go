package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.Register(c.Request.Context(), input, c.ClientIP())
	if err != nil {
		if errors.Is(err, ErrUserExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "user_exists", "message": "Email already registered"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusCreated, tokens)
}

func (h *Handler) RegisterConsumer(c *gin.Context) {
	var input ConsumerRegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.RegisterConsumer(c.Request.Context(), input, c.ClientIP())
	if err != nil {
		if errors.Is(err, ErrPhoneExists) {
			c.JSON(http.StatusConflict, gin.H{"error": "phone_exists", "message": "Phone number already registered"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "registration_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tokens)
}

func (h *Handler) LoginByPhone(c *gin.Context) {
	var input struct {
		TenantID string `json:"tenant_id" binding:"required"`
		Phone    string `json:"phone" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.LoginByPhone(c.Request.Context(), input.TenantID, input.Phone, input.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

func (h *Handler) Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.Login(c.Request.Context(), input)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_credentials"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

func (h *Handler) RequestPasswordReset(c *gin.Context) {
	var input PasswordResetRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	otpID, refCode, err := h.svc.RequestPasswordReset(c.Request.Context(), input)
	if err != nil {
		if errors.Is(err, ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found", "message": "ไม่พบบัญชีที่ตรงกับหมายเลขโทรศัพท์นี้"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "password_reset_request_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"otp_id": otpID, "ref_code": refCode})
}

func (h *Handler) ResetPassword(c *gin.Context) {
	var input PasswordResetInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	if err := h.svc.ResetPassword(c.Request.Context(), input); err != nil {
		if errors.Is(err, ErrUserNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "user_not_found", "message": "ไม่พบบัญชีที่ต้องการเปลี่ยนรหัสผ่าน"})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "password_reset_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Password has been reset"})
}

func (h *Handler) Refresh(c *gin.Context) {
	var input struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.RefreshToken(c.Request.Context(), input.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// CompleteProfile handles the membership registration for LINE users
func (h *Handler) CompleteProfile(c *gin.Context) {
	tenantID := c.GetString("tenant_id")
	userID := c.GetString("user_id")
	if tenantID == "" || userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var input CompleteProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation_error", "message": err.Error()})
		return
	}

	tokens, err := h.svc.CompleteProfile(c.Request.Context(), tenantID, userID, input)
	if err != nil {
		if errors.Is(err, ErrPhoneExists) {
			c.JSON(http.StatusConflict, gin.H{
				"error":   "phone_exists",
				"message": "เบอร์นี้ถูกใช้แล้ว กรุณาติดต่อ Admin",
			})
			return
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": "registration_failed", "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tokens)
}

// GetPDPA returns the authenticated user's PDPA consent records
func (h *Handler) GetPDPA(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	consents, err := h.svc.GetPDPAConsents(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"consents": consents})
}

// WithdrawPDPA records consent withdrawal and marks user as requesting deletion
func (h *Handler) WithdrawPDPA(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	if err := h.svc.WithdrawPDPAConsent(c.Request.Context(), userID, c.ClientIP()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal_error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Consent withdrawn. Your deletion request has been recorded."})
}
