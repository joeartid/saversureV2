package migrationjob

import "time"

const (
	ModuleCustomer      = "customer"
	ModuleProduct       = "product"
	ModuleRewards       = "rewards"
	ModuleScanHistory   = "scan_history"
	ModuleRedeemHistory = "redeem_history"

	JobModeDryRun  = "dry_run"
	JobModeExecute = "execute"

	JobStatusQueued    = "queued"
	JobStatusRunning   = "running"
	JobStatusCompleted = "completed"
	JobStatusFailed    = "failed"
	JobStatusCancelled = "cancelled"

	EntityTypeProduct = "product"
	EntityTypeReward  = "reward"
	EntityTypeScan    = "scan_history"
	EntityTypeRedeem  = "redeem_history"
	EntityTypeAddress = "address"
)

var moduleOrder = []string{
	ModuleCustomer,
	ModuleProduct,
	ModuleRewards,
	ModuleScanHistory,
	ModuleRedeemHistory,
}

type CreateJobInput struct {
	Modules   []string `json:"modules" binding:"required"`
	Mode      string   `json:"mode"`
	ChunkSize int      `json:"chunk_size"`
}

type SourceConfig struct {
	Label       string `json:"label"`
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Database    string `json:"database"`
	User        string `json:"user"`
	SSLMode     string `json:"sslmode"`
	HasPassword bool   `json:"has_password"`
}

type Job struct {
	ID                   string         `json:"id"`
	TenantID             string         `json:"tenant_id"`
	RequestedBy          string         `json:"requested_by"`
	RequestedByName      *string        `json:"requested_by_name,omitempty"`
	Mode                 string         `json:"mode"`
	Status               string         `json:"status"`
	SourceSystem         string         `json:"source_system"`
	SelectedModules      []string       `json:"selected_modules"`
	SourceConfigSnapshot SourceConfig   `json:"source_config_snapshot"`
	Options              JobOptions     `json:"options"`
	CurrentModule        *string        `json:"current_module,omitempty"`
	CurrentStep          *string        `json:"current_step,omitempty"`
	TotalItems           int64          `json:"total_items"`
	ProcessedItems       int64          `json:"processed_items"`
	SuccessCount         int64          `json:"success_count"`
	FailedCount          int64          `json:"failed_count"`
	WarningCount         int64          `json:"warning_count"`
	Percent              float64        `json:"percent"`
	Report               map[string]any `json:"report"`
	LastError            *string        `json:"last_error,omitempty"`
	StartedAt            *string        `json:"started_at,omitempty"`
	FinishedAt           *string        `json:"finished_at,omitempty"`
	CreatedAt            string         `json:"created_at"`
}

type JobOptions struct {
	ChunkSize int `json:"chunk_size"`
}

type JobModule struct {
	ID             string         `json:"id"`
	JobID          string         `json:"job_id"`
	ModuleName     string         `json:"module_name"`
	DependencyOrder int           `json:"dependency_order"`
	Status         string         `json:"status"`
	CurrentStep    *string        `json:"current_step,omitempty"`
	EstimatedCount int64          `json:"estimated_count"`
	ProcessedCount int64          `json:"processed_count"`
	SuccessCount   int64          `json:"success_count"`
	FailedCount    int64          `json:"failed_count"`
	WarningCount   int64          `json:"warning_count"`
	Percent        float64        `json:"percent"`
	Warnings       []string       `json:"warnings"`
	Summary        map[string]any `json:"summary"`
	StartedAt      *string        `json:"started_at,omitempty"`
	FinishedAt     *string        `json:"finished_at,omitempty"`
}

type JobError struct {
	ID               string         `json:"id"`
	JobID            string         `json:"job_id"`
	ModuleName       string         `json:"module_name"`
	SourceEntityType *string        `json:"source_entity_type,omitempty"`
	SourceID         *string        `json:"source_id,omitempty"`
	Message          string         `json:"message"`
	Details          map[string]any `json:"details"`
	CreatedAt        string         `json:"created_at"`
}

type JobDetail struct {
	Job     *Job       `json:"job"`
	Modules []JobModule `json:"modules"`
	Errors  []JobError `json:"errors"`
}

type moduleOutcome struct {
	Estimated int64
	Processed int64
	Success   int64
	Failed    int64
	Warnings  []string
	Summary   map[string]any
}

type moduleContext struct {
	JobID      string
	ModuleName string
	TenantID   string
	RequestedBy string
	Mode       string
	ChunkSize  int
	Source     *sourceDB
	StartedAt  time.Time
}
