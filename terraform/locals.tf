locals {
  tags = {
    project = var.project
    managed = "terraform"
  }

  ots_endpoint = "https://${var.ots_instance_name}.${var.region}.ots.aliyuncs.com"
  oss_endpoint = "oss-${var.region}.aliyuncs.com"
  fc_code_key  = "fc/${var.fc_function_name}.zip"
  fc_custom_domain = var.fc_custom_domain != "" ? var.fc_custom_domain : "api.${var.domain}"

  ots_tables = {
    pd_holdings = {
      pk_name = "holding_id"
      pk_type = "String"
    }
    pd_snapshots = {
      pk_name = "snapshot_date"
      pk_type = "String"
    }
    pd_visits = {
      pk_name = "visit_id"
      pk_type = "String"
    }
    pd_visit_images = {
      pk_name = "image_id"
      pk_type = "String"
    }
    pd_flights = {
      pk_name = "flight_id"
      pk_type = "String"
    }
    pd_trains = {
      pk_name = "train_id"
      pk_type = "String"
    }
    pd_movies = {
      pk_name = "douban_subject_id"
      pk_type = "String"
    }
  }

  # table_name => { index_name, pk_name, fields: { name => type } }
  ots_search_indexes = {
    pd_holdings = {
      index_name = "idx_holdings"
      pk_name    = "holding_id"
      fields = {
        bank        = "Text"
        asset_type  = "Text"
        risk_level  = "Long"
        currency    = "Text"
        updated_at  = "Text"
      }
    }
    pd_visits = {
      index_name = "idx_visits"
      pk_name    = "visit_id"
      fields = {
        city     = "Text"
        province = "Text"
        type     = "Text"
        date     = "Text"
        country  = "Text"
      }
    }
    pd_flights = {
      index_name = "idx_flights"
      pk_name    = "flight_id"
      fields = {
        flight_date     = "Text"
        airline         = "Text"
        departure_city  = "Text"
        arrival_city    = "Text"
      }
    }
    pd_trains = {
      index_name = "idx_trains"
      pk_name    = "train_id"
      fields = {
        train_date         = "Text"
        train_number       = "Text"
        departure_station  = "Text"
        arrival_station    = "Text"
      }
    }
    pd_movies = {
      index_name = "idx_movies"
      pk_name    = "douban_subject_id"
      fields = {
        director     = "Text"
        release_year = "Long"
        user_rating  = "Long"
        watched_date = "Text"
      }
    }
    pd_visit_images = {
      index_name = "idx_visit_images"
      pk_name    = "image_id"
      fields = {
        visit_id = "Text"
      }
    }
  }

  fc_env = {
    AUTH_URL                         = var.auth_url
    AUTH_SECRET                      = var.auth_secret
    AUTH_MICROSOFT_ENTRA_ID_ID       = var.auth_microsoft_entra_id_id
    AUTH_MICROSOFT_ENTRA_ID_SECRET   = var.auth_microsoft_entra_id_secret
    ALLOWED_USER_EMAIL               = var.allowed_user_email
    ALIBABA_CLOUD_ACCESS_KEY_ID      = var.runtime_access_key
    ALIBABA_CLOUD_ACCESS_KEY_SECRET  = var.runtime_secret_key
    OTS_ENDPOINT                     = local.ots_endpoint
    OTS_INSTANCE_NAME                = var.ots_instance_name
    OSS_VAULT_BUCKET                 = var.oss_vault_bucket
    OSS_VAULT_REGION                 = "oss-${var.region}"
    OSS_VAULT_ENDPOINT               = local.oss_endpoint
    PORT                             = "9000"
    HOSTNAME                         = "0.0.0.0"
    PATH                             = "/var/fc/lang/nodejs20/bin:/usr/local/bin:/usr/bin:/bin"
  }
}
