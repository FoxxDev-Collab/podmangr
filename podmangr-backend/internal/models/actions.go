package models

// Action constants for non-container actions
// (Container actions are defined in container.go)
// (Audit system removed but constants kept for compatibility)
const (
	// Auth actions
	ActionLogin         = "auth.login"
	ActionLoginFailed   = "auth.login_failed"
	ActionLogout        = "auth.logout"
	ActionSessionRevoke = "auth.session_revoke"

	// User actions
	ActionUserCreate = "user.create"
	ActionUserUpdate = "user.update"
	ActionUserDelete = "user.delete"

	// Template actions (update not in container.go)
	ActionTemplateUpdate = "template.update"

	// Stack actions (start not in container.go)
	ActionStackStart = "stack.start"

	// System actions
	ActionProcessKill = "process.kill"
	ActionUpdateApply = "update.apply"

	// Service actions
	ActionServiceStart   = "service.start"
	ActionServiceStop    = "service.stop"
	ActionServiceRestart = "service.restart"
	ActionServiceReload  = "service.reload"
	ActionServiceEnable  = "service.enable"
	ActionServiceDisable = "service.disable"

	// Network actions
	ActionNetworkConfigure = "network.configure"

	// Firewall actions
	ActionFirewallZoneCreate = "firewall.zone_create"
	ActionFirewallZoneDelete = "firewall.zone_delete"
	ActionFirewallZoneUpdate = "firewall.zone_update"
	ActionFirewallRuleCreate = "firewall.rule_create"
	ActionFirewallRuleDelete = "firewall.rule_delete"

	// Route actions
	ActionRouteAdd    = "route.add"
	ActionRouteDelete = "route.delete"
)
