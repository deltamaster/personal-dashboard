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
# CAS InstanceId cas_dv-cn-l224z7o2302g (cert-jur3x) → CertificateId for CDN cert_type=cas
cdn_cas_cert_id = "27493195"

# Public personal site — www.huhansen.cn (static pages + /api/songs → FC www-songs)
create_www_site   = true
www_domain        = "www.huhansen.cn"
oss_www_bucket    = "huhansen-www"
# CAS InstanceId cas_dv-cn-l224z7o2302f (cert-gz0sn) → CertificateId for CDN cert_type=cas
www_cdn_cas_cert_id = "27493192"
