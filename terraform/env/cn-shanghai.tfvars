# Shanghai stack — pd.huhansen.cn (ICP complete). Apply via workflow_dispatch only.

region            = "cn-shanghai"
ots_instance_name = "pd-dashboard"
oss_web_bucket    = "huhansen-web"
oss_vault_bucket  = "personal-dashboard-vault"
domain            = "pd.huhansen.cn"
auth_url          = "https://pd.huhansen.cn"
cdn_scope         = "domestic"
create_cdn_domain = true
cdn_https_enabled = true
# CAS InstanceId cas_dv-cn-o8p4uiogy03q → CertificateId for CDN cert_type=cas
cdn_cas_cert_id   = "25887176"
cas_dns_zone      = "huhansen.cn"
