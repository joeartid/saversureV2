package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"saversure/internal/apikey"
	"saversure/internal/audit"
	"saversure/internal/auth"
	"saversure/internal/batch"
	"saversure/internal/branding"
	"saversure/internal/campaign"
	"saversure/internal/code"
	"saversure/internal/config"
	"saversure/internal/coupon"
	"saversure/internal/currency"
	"saversure/internal/customer"
	"saversure/internal/dashboard"
	"saversure/internal/donation"
	"saversure/internal/engine"
	"saversure/internal/export"
	"saversure/internal/factory"
	"saversure/internal/fulfillment"
	"saversure/internal/gamification"
	"saversure/internal/geo"
	"saversure/internal/inventory"
	"saversure/internal/ledger"
	"saversure/internal/linebot"
	"saversure/internal/luckydraw"
	mw "saversure/internal/middleware"
	"saversure/internal/migrationjob"
	"saversure/internal/navmenu"
	"saversure/internal/news"
	"saversure/internal/notification"
	"saversure/internal/opsdigest"
	"saversure/internal/otp"
	"saversure/internal/pageconfig"
	"saversure/internal/platform"
	"saversure/internal/popup"
	"saversure/internal/product"
	"saversure/internal/profile"
	"saversure/internal/promotion"
	"saversure/internal/qc"
	"saversure/internal/redemption"
	"saversure/internal/reward"
	"saversure/internal/roll"
	"saversure/internal/scanhistory"
	"saversure/internal/staff"
	"saversure/internal/support"
	"saversure/internal/tenant"
	"saversure/internal/tier"
	"saversure/internal/transaction"
	"saversure/internal/upload"
	"saversure/internal/webhook"
	"saversure/pkg/cache"
	"saversure/pkg/database"
	qrhmac "saversure/pkg/hmac"
	"saversure/pkg/queue"
)

func main() {
	_ = godotenv.Load(".env", "../.env", "../../.env", "../../../.env") // Try multiple depths

	cfg, err := config.Load()
	if err != nil {
		slog.Error("failed to load config", "error", err)
		os.Exit(1)
	}

	setupLogger(cfg.App.Env)

	// --- Infrastructure ---
	db, err := database.NewPool(cfg.DB.DSN(), cfg.DB.MaxConns, cfg.DB.MinConns)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	slog.Info("connected to PostgreSQL")

	rdb, err := cache.NewRedisClient(cfg.Redis.Addr(), cfg.Redis.Password, cfg.Redis.DB)
	if err != nil {
		slog.Error("failed to connect to Redis", "error", err)
		os.Exit(1)
	}
	defer rdb.Close()
	slog.Info("connected to Redis")

	nc, err := queue.NewNATSConn(cfg.NATS.URL)
	if err != nil {
		slog.Warn("failed to connect to NATS (non-fatal for MVP)", "error", err)
	} else {
		defer nc.Close()
		slog.Info("connected to NATS")
	}
	_ = nc // Will be used for async notifications in the future

	signer := qrhmac.NewSigner(cfg.HMAC.Secret)

	// --- Services ---
	tenantSvc := tenant.NewService(db)
	authSvc := auth.NewService(db, cfg.JWT.Secret, cfg.JWT.AccessTTL, cfg.JWT.RefreshTTL)
	lineSvc := auth.NewLINEService(db, authSvc, auth.LINEConfig{
		ChannelID:     cfg.LINE.ChannelID,
		ChannelSecret: cfg.LINE.ChannelSecret,
		CallbackURL:   cfg.LINE.CallbackURL,
	})
	googleSvc := auth.NewGoogleService(db, authSvc, auth.GoogleConfig{
		ClientID: cfg.Google.ClientID,
	})
	rollSvc := roll.NewService(db)
	campaignSvc := campaign.NewService(db)
	batchSvc := batch.NewService(db, signer, rollSvc)
	inventorySvc := inventory.NewService(db)
	couponSvc := coupon.NewService(db)
	ledgerSvc := ledger.NewService(db)
	auditSvc := audit.NewService(db)
	promoSvc := promotion.NewService(db)
	codeSvc := code.NewService(db, signer, ledgerSvc, promoSvc)
	redemptionSvc := redemption.NewService(db, inventorySvc, ledgerSvc, couponSvc)

	missionEngine := engine.NewMissionEngine(db)
	notifEngine := engine.NewNotificationEngine(db)
	_ = missionEngine // will be wired into scan/redeem handlers
	_ = notifEngine

	// --- Handlers ---
	tenantHandler := tenant.NewHandler(tenantSvc)
	authHandler := auth.NewHandler(authSvc)
	lineHandler := auth.NewLINEHandler(lineSvc)
	googleHandler := auth.NewGoogleHandler(googleSvc)
	campaignHandler := campaign.NewHandler(campaignSvc)
	batchHandler := batch.NewHandler(batchSvc, db)
	inventoryHandler := inventory.NewHandler(inventorySvc)
	couponHandler := coupon.NewHandler(couponSvc)
	ledgerHandler := ledger.NewHandler(ledgerSvc)
	auditHandler := audit.NewHandler(auditSvc)
	codeHandler := code.NewHandler(codeSvc)
	qcHandler := qc.NewHandler(db)
	rollHandler := roll.NewHandler(rollSvc)
	redemptionHandler := redemption.NewHandler(redemptionSvc)
	rewardHandler := reward.NewHandler(db)
	dashboardHandler := dashboard.NewHandler(db)
	scanHistoryHandler := scanhistory.NewHandler(db)
	transactionHandler := transaction.NewHandler(db)
	customerHandler := customer.NewHandler(db)
	mergeHandler := customer.NewMergeHandler(db)
	profileHandler := profile.NewHandler(db)
	staffHandler := staff.NewHandler(db)
	productHandler := product.NewHandler(db)
	promoHandler := promotion.NewHandler(promoSvc)
	factoryHandler := factory.NewHandler(db)
	newsHandler := news.NewHandler(db)
	pageConfigHandler := pageconfig.NewHandler(db)
	popupHandler := popup.NewHandler(db)
	navMenuHandler := navmenu.NewHandler(db)
	supportHandler := support.NewHandler(db)
	luckyDrawHandler := luckydraw.NewHandler(db)
	donationHandler := donation.NewHandler(db)
	notifHandler := notification.NewHandler(db)
	currencyHandler := currency.NewHandler(db)
	apiKeyHandler := apikey.NewHandler(db)
	webhookHandler := webhook.NewHandler(db)
	gamifyHandler := gamification.NewHandler(db)
	tierHandler := tier.NewHandler(db)
	brandingHandler := branding.NewHandler(db)
	linebotSvc := linebot.NewService(db)
	linebotHandler := linebot.NewHandler(linebotSvc)
	fulfillmentSvc := fulfillment.NewService(db)
	fulfillmentHandler := fulfillment.NewHandler(fulfillmentSvc)
	geoSvc := geo.NewService(db)
	geoHandler := geo.NewHandler(geoSvc)
	opsDigestSvc := opsdigest.NewService(db)
	opsDigestHandler := opsdigest.NewHandler(opsDigestSvc)
	platformIdentitySvc := platform.NewIdentityService(db)
	platformLedgerSvc := platform.NewLedgerService(db)
	platformExchangeSvc := platform.NewExchangeService(db, platformIdentitySvc, platformLedgerSvc)
	platformHandler := platform.NewHandler(platformIdentitySvc, platformLedgerSvc, platformExchangeSvc)
	migrationSvc := migrationjob.NewService(db, cfg)
	migrationHandler := migrationjob.NewHandler(migrationSvc)
	if err := migrationSvc.RecoverInterruptedJobs(context.Background()); err != nil {
		slog.Warn("failed to recover interrupted migration jobs", "error", err)
	}

	var uploadHandler *upload.Handler
	var exportHandler *export.Handler
	var mediaProxy *upload.ProxyHandler
	if cfg.MinIO.AccessKey != "" {
		uh, err := upload.NewHandler(upload.Config{
			Endpoint:     cfg.MinIO.Endpoint,
			AccessKey:    cfg.MinIO.AccessKey,
			SecretKey:    cfg.MinIO.SecretKey,
			Bucket:       cfg.MinIO.Bucket,
			UseSSL:       cfg.MinIO.UseSSL,
			PublicURL:    cfg.MinIO.PublicURL,
			GeminiAPIKey: cfg.Google.GeminiAPIKey,
		})
		if err != nil {
			slog.Warn("MinIO not available (upload disabled)", "error", err)
		} else {
			uploadHandler = uh
			slog.Info("MinIO connected", "endpoint", cfg.MinIO.Endpoint)
		}

		// Media proxy — ให้ browser ดึงไฟล์จาก MinIO ผ่าน backend
		if ph, phErr := upload.NewProxyHandler(cfg.MinIO.Endpoint, cfg.MinIO.AccessKey, cfg.MinIO.SecretKey, cfg.MinIO.UseSSL); phErr == nil {
			mediaProxy = ph
		}

		mc, mcErr := minioClient(cfg)
		if mcErr == nil {
			apiBase := fmt.Sprintf("http://localhost:%d", cfg.App.Port)
			exportSvc := export.NewService(db, mc, cfg.MinIO.Bucket, cfg.MinIO.PublicURL, signer)
			exportHandler = export.NewHandler(exportSvc, apiBase)
		}
	} else {
		slog.Warn("MinIO not configured (upload disabled)")
	}

	// --- Router ---
	if cfg.App.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(mw.RequestLogger())
	r.Use(mw.CORS(cfg.CORSOrigins))

	// Routes introspection (dev tool — list all registered routes)
	r.GET("/api/v1/_routes", func(c *gin.Context) {
		routes := r.Routes()
		list := make([]gin.H, 0, len(routes))
		for _, rt := range routes {
			list = append(list, gin.H{
				"method":  rt.Method,
				"path":    rt.Path,
				"handler": rt.Handler,
			})
		}
		c.JSON(http.StatusOK, gin.H{
			"count":  len(list),
			"routes": list,
		})
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		dbOK := db.Ping(context.Background()) == nil
		status := "ok"
		httpCode := http.StatusOK
		if !dbOK {
			status = "degraded"
			httpCode = http.StatusServiceUnavailable
		}
		c.JSON(httpCode, gin.H{
			"status":  status,
			"service": "saversure-api",
			"version": "2.0.0",
			"db":      dbOK,
		})
	})

	// Public download (no auth required)
	if exportHandler != nil {
		r.GET("/api/v1/exports/download/:token", exportHandler.Download)
	}

	// Media proxy — ให้ browser ดึงไฟล์จาก MinIO ผ่าน backend (public, no auth)
	if mediaProxy != nil {
		r.GET("/media/:bucket/*objectPath", mediaProxy.ServeFile)
	}

	api := r.Group("/api/v1")

	// --- Auth (public) ---
	authRoutes := api.Group("/auth")
	{
		authRoutes.POST("/register", authHandler.Register)
		authRoutes.POST("/register-consumer", authHandler.RegisterConsumer)
		authRoutes.POST("/login", authHandler.Login)
		authRoutes.POST("/login-phone", authHandler.LoginByPhone)
		authRoutes.POST("/refresh", authHandler.Refresh)
		authRoutes.POST("/password/request", authHandler.RequestPasswordReset)
		authRoutes.POST("/password/reset", authHandler.ResetPassword)
		authRoutes.GET("/line", lineHandler.GetAuthURL)
		authRoutes.POST("/line/callback", lineHandler.Callback)
		authRoutes.POST("/line/liff-token", lineHandler.LIFFLogin)
		authRoutes.GET("/line/liff-id", lineHandler.GetLIFFID)
		authRoutes.GET("/google/config", googleHandler.GetConfig)
		authRoutes.POST("/google/login", googleHandler.Login)
	}

	// --- OTP (public, no auth) ---
	if cfg.SMS.Host != "" && cfg.SMS.Username != "" && cfg.SMS.Password != "" && cfg.SMS.OTCOtcID != "" {
		antsClient := otp.NewAntsClient(cfg.SMS.Host, cfg.SMS.Username, cfg.SMS.Password, cfg.SMS.OTCOtcID)
		otpSvc := otp.NewService(antsClient, rdb)
		otpHandler := otp.NewHandler(otpSvc)
		authSvc.SetOTPVerifier(otpSvc)
		otpRoutes := api.Group("/otp")
		{
			otpRoutes.POST("/request", otpHandler.Request)
			otpRoutes.POST("/verify", otpHandler.Verify)
		}
		slog.Info("OTP (Ants SMS) enabled")
	} else {
		slog.Warn("OTP disabled: SMS credentials not configured")
	}

	// --- Public utilities (no auth) ---
	api.GET("/public/resolve-ref1", codeHandler.ResolveRef1)
	api.GET("/public/tenant-by-slug", tenantHandler.ResolveSlug)
	api.GET("/public/branding-by-slug", brandingHandler.GetBySlug)

	// --- QR Redirect ---
	// Legacy: qr.svsu.me/s/:code → resolve from batch prefix
	r.GET("/s/:code", codeHandler.ResolveRedirect)

	// V2: qr.svsu.me/{shortcode}/{ref1} → resolve from brand shortcode
	// Uses NoRoute fallback because /:shortcode/:ref1 would conflict with /health, /api, etc.
	r.NoRoute(codeHandler.ResolveRedirectV2)

	// --- Protected routes ---
	protected := api.Group("")
	protected.Use(mw.JWTAuth(cfg.JWT.Secret))

	// Tenant (Super Admin)
	tenantRoutes := protected.Group("/tenants")
	tenantRoutes.Use(mw.RequireRole("super_admin"))
	{
		tenantRoutes.POST("", tenantHandler.Create)
		tenantRoutes.GET("", tenantHandler.List)
		tenantRoutes.GET("/:id", tenantHandler.GetByID)
		tenantRoutes.PATCH("/:id", tenantHandler.Update)
	}

	// Settings (Brand Admin) - ใช้ tenant_id จาก JWT โดยตรง ไม่ต้องผ่าน TenantIsolation
	settingsRoutes := protected.Group("/settings")
	settingsRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		settingsRoutes.GET("/tenant", tenantHandler.GetCurrent)
		settingsRoutes.PATCH("/tenant", tenantHandler.UpdateCurrent)
	}

	// Routes that require tenant context
	tenanted := protected.Group("")
	tenanted.Use(mw.TenantIsolation())

	// Campaign (Brand Admin)
	campaignRoutes := tenanted.Group("/campaigns")
	campaignRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		campaignRoutes.POST("", campaignHandler.Create)
		campaignRoutes.GET("", campaignHandler.List)
		campaignRoutes.GET("/:id", campaignHandler.GetByID)
		campaignRoutes.PATCH("/:id", campaignHandler.Update)
		campaignRoutes.POST("/:id/publish", campaignHandler.Publish)
	}

	// Batch (Brand Admin / Factory User)
	batchRoutes := tenanted.Group("/batches")
	batchRoutes.Use(mw.RequireRole("super_admin", "brand_admin", "factory_user"))
	{
		batchRoutes.POST("", batchHandler.Create)
		batchRoutes.GET("", batchHandler.List)
		batchRoutes.GET("/:id/export", batchHandler.Export)
		batchRoutes.PATCH("/:id/status", batchHandler.UpdateStatus)
		batchRoutes.POST("/:id/recall", batchHandler.Recall)
	}

	// Rewards / Inventory (Brand Admin)
	rewardRoutes := tenanted.Group("/rewards")
	rewardRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		rewardRoutes.POST("", inventoryHandler.CreateReward)
		rewardRoutes.GET("", inventoryHandler.List)
		rewardRoutes.GET("/:id", inventoryHandler.GetByID)
		rewardRoutes.PATCH("/:id", inventoryHandler.UpdateReward)
		rewardRoutes.PATCH("/:id/inventory", inventoryHandler.UpdateInventory)
	}

	// Coupon code pool (Brand Admin)
	couponRoutes := tenanted.Group("/coupons")
	couponRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		couponRoutes.POST("/import", couponHandler.Import)
		couponRoutes.GET("", couponHandler.List)
		couponRoutes.GET("/:rewardId/available", couponHandler.CountAvailable)
		couponRoutes.DELETE("/:rewardId/unclaimed", couponHandler.DeleteUnclaimed)
	}

	// QR Scan (Public users, rate limited)
	scanRoutes := tenanted.Group("/scan")
	scanRoutes.Use(mw.RateLimit(rdb, "scan", cfg.RateLimit.Scan, time.Minute))
	{
		scanRoutes.POST("", codeHandler.Scan)
	}

	// Code Lookup (Admin — validate code and show info without scanning)
	codeRoutes := tenanted.Group("/codes")
	codeRoutes.Use(mw.RequireRole("super_admin", "brand_admin", "factory_user"))
	{
		codeRoutes.GET("/lookup", codeHandler.Lookup)
	}

	// Roll Management (Admin / Factory)
	rollRoutes := tenanted.Group("/rolls")
	rollRoutes.Use(mw.RequireRole("super_admin", "brand_admin", "factory_user"))
	{
		rollRoutes.GET("", rollHandler.List)
		rollRoutes.GET("/stats", rollHandler.GetStats)
		rollRoutes.GET("/:id", rollHandler.GetByID)
		rollRoutes.POST("/:id/map", rollHandler.MapProduct)
		rollRoutes.POST("/:id/unmap", rollHandler.Unmap)
		rollRoutes.POST("/:id/qc", rollHandler.QCReview)
		rollRoutes.POST("/:id/report-ref2", rollHandler.ReportRef2)
		rollRoutes.PATCH("/:id/status", rollHandler.UpdateStatus)
		rollRoutes.POST("/bulk-map", rollHandler.BulkMap)
		rollRoutes.POST("/bulk-status", rollHandler.BulkUpdateStatus)
		if exportHandler != nil {
			rollRoutes.GET("/:id/sample-codes", exportHandler.SampleCodes)
		}
		// Admin-only: assign rolls to factory
		adminOnly := rollRoutes.Group("")
		adminOnly.Use(mw.RequireRole("super_admin", "brand_admin"))
		{
			adminOnly.PATCH("/:id/assign", rollHandler.Assign)
			adminOnly.POST("/bulk-assign", rollHandler.BulkAssign)
		}
	}

	// QC Verify (Factory / QC staff)
	qcRoutes := tenanted.Group("/qc")
	qcRoutes.Use(mw.RequireRole("super_admin", "brand_admin", "factory_user"))
	{
		qcRoutes.GET("/verify", qcHandler.Verify)
	}

	// Redemption (rate limited, idempotent)
	redeemRoutes := tenanted.Group("/redeem")
	redeemRoutes.Use(mw.RateLimit(rdb, "redeem", cfg.RateLimit.Redeem, time.Minute))
	{
		redeemRoutes.POST("", mw.Idempotency(rdb, 10*time.Minute), redemptionHandler.Redeem)
		redeemRoutes.POST("/:id/confirm", redemptionHandler.Confirm)
	}

	// Points / Ledger
	pointsRoutes := tenanted.Group("/points")
	{
		pointsRoutes.GET("/balance", ledgerHandler.GetBalance)
		pointsRoutes.GET("/history", ledgerHandler.GetHistory)
	}

	// Point Refund (Admin)
	refundRoutes := tenanted.Group("/points/refund")
	refundRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		refundRoutes.POST("", ledgerHandler.RefundPoints)
	}

	// Audit (Super Admin)
	auditRoutes := tenanted.Group("/audit")
	auditRoutes.Use(mw.RequireRole("super_admin"))
	{
		auditRoutes.GET("", auditHandler.List)
	}

	// Geolocation (Admin)
	geoRoutes := tenanted.Group("/geo")
	geoRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		geoRoutes.GET("/reverse", geoHandler.ReverseGeocode)
		geoRoutes.POST("/backfill", geoHandler.BackfillProvinces)
	}

	// Scan History (Admin)
	scanHistoryRoutes := tenanted.Group("/scan-history")
	scanHistoryRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		scanHistoryRoutes.GET("", scanHistoryHandler.List)
		scanHistoryRoutes.GET("/alerts", scanHistoryHandler.GetAlerts)
		scanHistoryRoutes.GET("/:id", scanHistoryHandler.GetByID)
	}

	// Redeem Transactions (Admin)
	txnRoutes := tenanted.Group("/redeem-transactions")
	txnRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		txnRoutes.GET("", transactionHandler.List)
		txnRoutes.GET("/summary", transactionHandler.Summary)
		txnRoutes.GET("/export", transactionHandler.ExportCSV)
		txnRoutes.PATCH("/:id", transactionHandler.UpdateStatus)
	}

	// Customer Management (Admin)
	customerRoutes := tenanted.Group("/customers")
	customerRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		customerRoutes.GET("", customerHandler.List)
		customerRoutes.GET("/search", mergeHandler.SearchUsers)
		customerRoutes.GET("/:id/detail", customerHandler.GetDetail)
		customerRoutes.GET("/:id", customerHandler.GetByID)
		customerRoutes.PATCH("/:id", customerHandler.Update)
		customerRoutes.POST("/:id/transfer-line", mergeHandler.TransferLINE)
		customerRoutes.POST("/merge", mergeHandler.Merge)
	}

	// Dashboard
	dashboardRoutes := tenanted.Group("/dashboard")
	dashboardRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		dashboardRoutes.GET("/summary", dashboardHandler.Summary)
		dashboardRoutes.GET("/scan-chart", dashboardHandler.ScanChart)
		dashboardRoutes.GET("/top-products", dashboardHandler.TopProducts)
		dashboardRoutes.GET("/funnel", dashboardHandler.ConversionFunnel)
		dashboardRoutes.GET("/geo-heatmap", dashboardHandler.GeoHeatmap)
		dashboardRoutes.GET("/recent-activity", dashboardHandler.RecentActivity)
	}

	// Staff Management (Brand Admin+)
	staffRoutes := tenanted.Group("/staff")
	staffRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		staffRoutes.GET("", staffHandler.List)
		staffRoutes.POST("", staffHandler.Create)
		staffRoutes.GET("/:id", staffHandler.Get)
		staffRoutes.PATCH("/:id", staffHandler.Update)
		staffRoutes.POST("/:id/reset-password", staffHandler.ResetPassword)
		staffRoutes.DELETE("/:id", staffHandler.Delete)
	}

	// Product Management
	productRoutes := tenanted.Group("/products")
	productRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		productRoutes.POST("", productHandler.Create)
		productRoutes.POST("/import", productHandler.ImportCSV)
		productRoutes.PATCH("/:id", productHandler.Update)
		productRoutes.DELETE("/:id", productHandler.Delete)
	}
	// factory_user สามารถดู product list ได้ (เพื่อ map สินค้า)
	productReadRoutes := tenanted.Group("/products")
	productReadRoutes.Use(mw.RequireRole("super_admin", "brand_admin", "factory_user"))
	{
		productReadRoutes.GET("", productHandler.List)
	}

	// Promotions (Brand Admin)
	promoRoutes := tenanted.Group("/promotions")
	promoRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		promoRoutes.GET("", promoHandler.List)
		promoRoutes.GET("/:id", promoHandler.GetByID)
		promoRoutes.POST("", promoHandler.Create)
		promoRoutes.PATCH("/:id", promoHandler.Update)
		promoRoutes.DELETE("/:id", promoHandler.Delete)
		promoRoutes.POST("/:id/submit", promoHandler.Submit)
		promoRoutes.POST("/:id/approve", promoHandler.Approve)
		promoRoutes.POST("/:id/reject", promoHandler.Reject)
		promoRoutes.POST("/:id/deactivate", promoHandler.Deactivate)
		promoRoutes.POST("/:id/reactivate", promoHandler.Reactivate)
	}

	// Factory Management
	factoryRoutes := tenanted.Group("/factories")
	factoryRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		factoryRoutes.GET("", factoryHandler.List)
		factoryRoutes.POST("", factoryHandler.Create)
		factoryRoutes.PATCH("/:id", factoryHandler.Update)
		factoryRoutes.DELETE("/:id", factoryHandler.Delete)
		// Factory Product assignments (admin only)
		factoryRoutes.GET("/:id/products", factoryHandler.ListProducts)
		factoryRoutes.POST("/:id/products", factoryHandler.AssignProduct)
		factoryRoutes.DELETE("/:id/products/:product_id", factoryHandler.RemoveProduct)
	}

	// Page Config CMS (Admin)
	pageConfigRoutes := tenanted.Group("/page-configs")
	pageConfigRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		pageConfigRoutes.GET("", pageConfigHandler.List)
		pageConfigRoutes.GET("/:slug", pageConfigHandler.GetBySlug)
		pageConfigRoutes.PUT("", pageConfigHandler.Upsert)
		pageConfigRoutes.DELETE("/:slug", pageConfigHandler.Delete)
		pageConfigRoutes.GET("/:slug/versions", pageConfigHandler.ListVersions)
		pageConfigRoutes.POST("/:slug/restore", pageConfigHandler.RestoreVersion)
		pageConfigRoutes.POST("/duplicate", pageConfigHandler.Duplicate)
	}

	// Popup Management (Admin)
	popupRoutes := tenanted.Group("/popups")
	popupRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		popupRoutes.GET("", popupHandler.List)
		popupRoutes.GET("/:id", popupHandler.GetByID)
		popupRoutes.POST("", popupHandler.Create)
		popupRoutes.PATCH("/:id", popupHandler.Update)
		popupRoutes.DELETE("/:id", popupHandler.Delete)
	}

	// Nav Menu Management (Admin)
	navMenuRoutes := tenanted.Group("/nav-menus")
	navMenuRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		navMenuRoutes.GET("", navMenuHandler.List)
		navMenuRoutes.GET("/:type", navMenuHandler.GetByType)
		navMenuRoutes.PUT("", navMenuHandler.Upsert)
		navMenuRoutes.DELETE("/:type", navMenuHandler.Delete)
		navMenuRoutes.GET("/:type/versions", navMenuHandler.ListVersions)
		navMenuRoutes.POST("/:type/restore", navMenuHandler.RestoreVersion)
	}

	// News Management (Admin)
	newsAdminRoutes := tenanted.Group("/news")
	newsAdminRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		newsAdminRoutes.GET("", newsHandler.List)
		newsAdminRoutes.GET("/:id", newsHandler.GetByID)
		newsAdminRoutes.POST("", newsHandler.Create)
		newsAdminRoutes.PATCH("/:id", newsHandler.Update)
		newsAdminRoutes.DELETE("/:id", newsHandler.Delete)
	}

	// Support Cases (Admin)
	supportAdminRoutes := tenanted.Group("/support/cases")
	supportAdminRoutes.Use(mw.RequireRole("super_admin", "brand_admin", "brand_staff"))
	{
		supportAdminRoutes.GET("", supportHandler.ListCases)
		supportAdminRoutes.GET("/:id", supportHandler.GetCase)
		supportAdminRoutes.PATCH("/:id", supportHandler.UpdateCase)
		supportAdminRoutes.POST("/:id/reply", supportHandler.Reply)
	}

	// Support Cases (Consumer)
	supportUserRoutes := tenanted.Group("/support/my-cases")
	{
		supportUserRoutes.GET("", supportHandler.ListUserCases)
		supportUserRoutes.POST("", supportHandler.CreateCase)
		supportUserRoutes.GET("/:id", supportHandler.GetCase)
		supportUserRoutes.POST("/:id/reply", supportHandler.Reply)
	}

	// Lucky Draw (Admin)
	luckyDrawAdminRoutes := tenanted.Group("/lucky-draw")
	luckyDrawAdminRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		luckyDrawAdminRoutes.GET("", luckyDrawHandler.ListCampaigns)
		luckyDrawAdminRoutes.GET("/:id", luckyDrawHandler.GetCampaign)
		luckyDrawAdminRoutes.POST("", luckyDrawHandler.CreateCampaign)
		luckyDrawAdminRoutes.PATCH("/:id", luckyDrawHandler.UpdateCampaign)
		luckyDrawAdminRoutes.POST("/:id/prizes", luckyDrawHandler.AddPrize)
		luckyDrawAdminRoutes.DELETE("/:id/prizes/:prizeId", luckyDrawHandler.DeletePrize)
		luckyDrawAdminRoutes.POST("/:id/draw", luckyDrawHandler.DrawWinners)
		luckyDrawAdminRoutes.GET("/:id/winners", luckyDrawHandler.GetWinners)
	}

	// Point Currencies (Admin)
	currencyRoutes := tenanted.Group("/currencies")
	currencyRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		currencyRoutes.GET("", currencyHandler.List)
		currencyRoutes.POST("", currencyHandler.Create)
		currencyRoutes.PATCH("/:id", currencyHandler.Update)
		currencyRoutes.DELETE("/:id", currencyHandler.Delete)
		currencyRoutes.POST("/:code/convert", currencyHandler.Convert)
	}

	// Donation (Admin)
	donationAdminRoutes := tenanted.Group("/donations")
	donationAdminRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		donationAdminRoutes.GET("", donationHandler.List)
		donationAdminRoutes.POST("", donationHandler.Create)
		donationAdminRoutes.PATCH("/:id", donationHandler.Update)
		donationAdminRoutes.GET("/:id/history", donationHandler.GetHistory)
	}

	// Notifications
	notifRoutes := tenanted.Group("/notifications")
	{
		notifRoutes.GET("", notifHandler.List)
		notifRoutes.GET("/unread-count", notifHandler.UnreadCount)
		notifRoutes.PATCH("/:id/read", notifHandler.MarkRead)
		notifRoutes.POST("/read-all", notifHandler.MarkAllRead)
	}

	// Reward Tiers (Admin)
	tierRoutes := tenanted.Group("/tiers")
	tierRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		tierRoutes.GET("", tierHandler.List)
		tierRoutes.POST("", tierHandler.Create)
		tierRoutes.PATCH("/:id", tierHandler.Update)
		tierRoutes.DELETE("/:id", tierHandler.Delete)
	}

	// Branding (Admin)
	brandingRoutes := tenanted.Group("/branding")
	brandingRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		brandingRoutes.GET("", brandingHandler.Get)
		brandingRoutes.PUT("", brandingHandler.Update)
	}

	// LINE Bot (Admin)
	linebotRoutes := tenanted.Group("/linebot")
	linebotRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		linebotRoutes.POST("/send", linebotHandler.SendMessage)
		linebotRoutes.POST("/broadcast", linebotHandler.Broadcast)
		linebotRoutes.POST("/rich-menu", linebotHandler.CreateRichMenu)
		linebotRoutes.GET("/rich-menu", linebotHandler.ListRichMenus)
	}

	// Ops Digest (Admin)
	opsRoutes := tenanted.Group("/ops")
	opsRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		opsRoutes.GET("/digest", opsDigestHandler.GetDigest)
		opsRoutes.GET("/alerts", opsDigestHandler.GetAlerts)
	}

	// Fulfillment (Admin)
	fulfillmentRoutes := tenanted.Group("/fulfillment")
	fulfillmentRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		fulfillmentRoutes.GET("", fulfillmentHandler.List)
		fulfillmentRoutes.PATCH("/:id", fulfillmentHandler.UpdateStatus)
		fulfillmentRoutes.POST("/bulk-update", fulfillmentHandler.BulkUpdate)
	}

	// API Keys (Admin)
	apiKeyRoutes := tenanted.Group("/api-keys")
	apiKeyRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		apiKeyRoutes.GET("", apiKeyHandler.List)
		apiKeyRoutes.POST("", apiKeyHandler.Create)
		apiKeyRoutes.PATCH("/:id/revoke", apiKeyHandler.Revoke)
		apiKeyRoutes.DELETE("/:id", apiKeyHandler.Delete)
	}

	// Migration Center (Admin)
	migrationRoutes := tenanted.Group("/migration-jobs")
	migrationRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		migrationRoutes.GET("/config/source", migrationHandler.GetSourceConfig)
		migrationRoutes.POST("", migrationHandler.Create)
		migrationRoutes.GET("", migrationHandler.List)
		migrationRoutes.GET("/:id", migrationHandler.Get)
		migrationRoutes.GET("/:id/errors", migrationHandler.Errors)
		migrationRoutes.POST("/:id/cancel", migrationHandler.Cancel)
		migrationRoutes.POST("/:id/retry", migrationHandler.Retry)
	}

	// Webhooks (Admin)
	webhookRoutes := tenanted.Group("/webhooks")
	webhookRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		webhookRoutes.GET("", webhookHandler.List)
		webhookRoutes.POST("", webhookHandler.Create)
		webhookRoutes.PATCH("/:id", webhookHandler.Update)
		webhookRoutes.DELETE("/:id", webhookHandler.Delete)
		webhookRoutes.GET("/:id/secret", webhookHandler.GetSecret)
		webhookRoutes.GET("/:id/logs", webhookHandler.GetLogs)
		webhookRoutes.POST("/:id/test", webhookHandler.Test)
	}

	// Gamification — Missions & Badges (Admin)
	missionRoutes := tenanted.Group("/missions")
	missionRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		missionRoutes.GET("", gamifyHandler.ListMissions)
		missionRoutes.POST("", gamifyHandler.CreateMission)
		missionRoutes.PATCH("/:id", gamifyHandler.UpdateMission)
		missionRoutes.DELETE("/:id", gamifyHandler.DeleteMission)
	}

	badgeRoutes := tenanted.Group("/badges")
	badgeRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
	{
		badgeRoutes.GET("", gamifyHandler.ListBadges)
		badgeRoutes.POST("", gamifyHandler.CreateBadge)
		badgeRoutes.PATCH("/:id", gamifyHandler.UpdateBadge)
		badgeRoutes.DELETE("/:id", gamifyHandler.DeleteBadge)
	}

	// Platform / Cross-Tenant (Consumer)
	platformRoutes := tenanted.Group("/platform")
	{
		platformRoutes.GET("/identity", platformHandler.GetMyPlatformIdentity)
		platformRoutes.POST("/link", platformHandler.LinkIdentity)
		platformRoutes.POST("/exchange", platformHandler.Exchange)
		platformRoutes.GET("/balance", platformHandler.GetPlatformBalance)
		platformRoutes.GET("/history", platformHandler.GetPlatformHistory)
	}

	// Platform Admin (Super Admin)
	platformAdminRoutes := tenanted.Group("/platform/admin")
	platformAdminRoutes.Use(mw.RequireRole("super_admin"))
	{
		platformAdminRoutes.GET("/users/:id", platformHandler.GetPlatformUser)
	}

	// File Upload (requires MinIO, rate limited)
	if uploadHandler != nil {
		uploadRoutes := tenanted.Group("/upload")
		uploadRoutes.Use(mw.RequireRole("super_admin", "brand_admin"))
		uploadRoutes.Use(mw.RateLimit(rdb, "upload", cfg.RateLimit.Upload, time.Minute))
		{
			uploadRoutes.POST("/file", uploadHandler.UploadFile)
		}
		// factory_user สามารถ upload รูปหลักฐานได้
		uploadImageRoute := tenanted.Group("/upload")
		uploadImageRoute.Use(mw.RequireRole("super_admin", "brand_admin", "factory_user"))
		uploadImageRoute.Use(mw.RateLimit(rdb, "upload", cfg.RateLimit.Upload, time.Minute))
		{
			uploadImageRoute.POST("/image", uploadHandler.UploadImage)
			uploadImageRoute.POST("/ai-generate", uploadHandler.AIGenerateImage)
		}
	}

	// Export Management (rate limited)
	if exportHandler != nil {
		exportRoutes := tenanted.Group("/exports")
		exportRoutes.Use(mw.RequireRole("super_admin", "brand_admin", "factory_user"))
		exportRoutes.Use(mw.RateLimit(rdb, "export", cfg.RateLimit.Export, time.Minute))
		{
			exportRoutes.POST("", exportHandler.Create)
			exportRoutes.GET("", exportHandler.List)
		}
	}

	// Popups — cosmetic, no tenant required (graceful fallback in handler)
	api.GET("/public/popups", popupHandler.ListActive)

	// Public Donations (no auth required)
	publicDonationRoutes := api.Group("/public/donations")
	publicDonationRoutes.Use(mw.TenantFromHeader())
	{
		publicDonationRoutes.GET("", donationHandler.ListActive)
	}

	// Rewards API (public - no auth required)
	publicRewardRoutes := api.Group("/public/rewards")
	publicRewardRoutes.Use(mw.TenantFromHeader())
	{
		publicRewardRoutes.GET("", rewardHandler.ListPublic)
		publicRewardRoutes.GET("/:id", rewardHandler.GetDetail)
	}

	// Missions API (public - no auth required)
	publicMissionRoutes := api.Group("/public/missions")
	publicMissionRoutes.Use(mw.TenantFromHeader())
	{
		publicMissionRoutes.GET("", gamifyHandler.ListMissions)
		publicMissionRoutes.GET("/:id", gamifyHandler.GetMission)
	}

	// Lucky Draw API (public - no auth required)
	publicLuckyDrawRoutes := api.Group("/public/lucky-draw")
	publicLuckyDrawRoutes.Use(mw.TenantFromHeader())
	{
		publicLuckyDrawRoutes.GET("", luckyDrawHandler.ListActiveCampaigns)
		publicLuckyDrawRoutes.GET("/:id", luckyDrawHandler.GetCampaign)
	}

	// Campaigns API (public - no auth required)
	publicCampaignRoutes := api.Group("/public/campaigns")
	publicCampaignRoutes.Use(mw.TenantFromHeader())
	{
		publicCampaignRoutes.GET("", campaignHandler.ListPublic)
	}

	// Branding API (public - consumer needs theme/logo)
	publicBrandingRoutes := api.Group("/public")
	publicBrandingRoutes.Use(mw.TenantFromHeader())
	{
		publicBrandingRoutes.GET("/branding", brandingHandler.GetPublic)
	}

	// Nav Menu API (public - consumer needs nav items)
	publicNavMenuRoutes := api.Group("/public/nav-menu")
	publicNavMenuRoutes.Use(mw.TenantFromHeader())
	{
		publicNavMenuRoutes.GET("/:type", navMenuHandler.GetPublic)
	}

	// News API (public - consumer news feed)
	publicNewsRoutes := api.Group("/public/news")
	publicNewsRoutes.Use(mw.TenantFromHeader())
	{
		publicNewsRoutes.GET("", newsHandler.ListPublished)
		publicNewsRoutes.GET("/:id", newsHandler.GetByID)
	}

	// Page Config API (public - consumer page builder rendering)
	publicPageConfigRoutes := api.Group("/public/page-config")
	publicPageConfigRoutes.Use(mw.TenantFromHeader())
	{
		publicPageConfigRoutes.GET("/:slug", pageConfigHandler.GetPublic)
	}

	// Tiers API (public - consumer tier badges/progress)
	publicTierRoutes := api.Group("/public/tiers")
	publicTierRoutes.Use(mw.TenantFromHeader())
	{
		publicTierRoutes.GET("", tierHandler.List)
	}

	// Consumer Profile (self)
	profileRoutes := tenanted.Group("/profile")
	{
		profileRoutes.GET("", profileHandler.GetProfile)
		profileRoutes.PATCH("", profileHandler.UpdateProfile)
		profileRoutes.POST("/complete", authHandler.CompleteProfile)
		profileRoutes.GET("/addresses", profileHandler.ListAddresses)
		profileRoutes.POST("/addresses", profileHandler.CreateAddress)
		profileRoutes.PATCH("/addresses/:id", profileHandler.UpdateAddress)
		profileRoutes.DELETE("/addresses/:id", profileHandler.DeleteAddress)
		profileRoutes.PATCH("/addresses/:id/default", profileHandler.SetDefaultAddress)
	}

	// User-specific actions (consumer)
	myRoutes := tenanted.Group("/my")
	{
		myRoutes.POST("/lucky-draw/:id/register", luckyDrawHandler.Register)
		myRoutes.GET("/lucky-draw/:id/tickets", luckyDrawHandler.GetUserTickets)
		myRoutes.GET("/lucky-draw/tickets", luckyDrawHandler.GetUserTickets)
		myRoutes.POST("/donations/:id/donate", donationHandler.Donate)
		myRoutes.GET("/donations", donationHandler.GetMyDonations)
		myRoutes.GET("/balances", currencyHandler.GetMultiBalance)
		myRoutes.GET("/redeem-transactions", transactionHandler.ListMine)
		myRoutes.GET("/missions", gamifyHandler.GetUserMissions)
		myRoutes.GET("/badges", gamifyHandler.GetUserBadges)
		myRoutes.GET("/tier", tierHandler.GetUserTier)
		myRoutes.GET("/pdpa", authHandler.GetPDPA)
		myRoutes.POST("/pdpa/withdraw", authHandler.WithdrawPDPA)
		myRoutes.GET("/scans", scanHistoryHandler.GetMyScans)
	}

	// --- Server ---
	srv := &http.Server{
		Addr:         cfg.ListenAddr(),
		Handler:      r,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  30 * time.Second,
	}

	go func() {
		slog.Info("starting server", "addr", cfg.ListenAddr(), "env", cfg.App.Env)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	slog.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	}

	slog.Info("server stopped")
}

func minioClient(cfg *config.Config) (*minio.Client, error) {
	return minio.New(cfg.MinIO.Endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.MinIO.AccessKey, cfg.MinIO.SecretKey, ""),
		Secure: cfg.MinIO.UseSSL,
	})
}

func setupLogger(env string) {
	opts := &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}
	if env == "production" {
		opts.Level = slog.LevelInfo
	}
	handler := slog.NewJSONHandler(os.Stdout, opts)
	slog.SetDefault(slog.New(handler))
}
