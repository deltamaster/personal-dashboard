# QA stack — full hosted clone of prod at pd-qa.huhansen.com (Singapore).
# Static frontend on OSS + FC API + CDN, with Microsoft auth ENFORCED
# (no auth bypass). Separate FC function name so it does not collide with prod.

region            = "ap-southeast-1"
ots_instance_name = "pd-dash-qa"
oss_web_bucket    = "pd-web-qa"
oss_vault_bucket  = "pd-vault-qa"
fc_function_name  = "api-qa"
domain            = "pd-qa.huhansen.com"
auth_url          = "https://pd-qa.huhansen.com"
cdn_scope         = "overseas"
create_cdn_domain = true
