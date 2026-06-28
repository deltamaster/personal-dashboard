# Singapore stack — active dev/staging until huhansen.cn ICP is ready.

region            = "ap-southeast-1"
ots_instance_name = "pd-dash-sg"
oss_web_bucket    = "pd-web-sg"
oss_vault_bucket  = "pd-vault-sg"
domain            = "pd-web-sg.oss-ap-southeast-1.aliyuncs.com"
# Set AUTH_URL GitHub secret to the FC HTTP trigger URL after first Terraform apply.
auth_url          = "https://placeholder.ap-southeast-1.fcapp.run"
create_cdn_domain = false
