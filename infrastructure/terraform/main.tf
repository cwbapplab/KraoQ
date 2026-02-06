terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 4.0.0"
    }
  }
}

provider "oci" {
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
  region           = var.region
}

resource "oci_core_vcn" "kraoq_vcn" {
  cidr_block     = "10.0.0.0/16"
  compartment_id = var.compartment_ocid
  display_name   = "kraoq_vcn"
  dns_label      = "kraoqvcn"
}

resource "oci_core_internet_gateway" "kraoq_igw" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.kraoq_vcn.id
  display_name   = "kraoq_igw"
}

resource "oci_core_default_route_table" "kraoq_rt" {
  manage_default_resource_id = oci_core_vcn.kraoq_vcn.default_route_table_id

  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.kraoq_igw.id
  }
}

resource "oci_core_security_list" "kraoq_sl" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.kraoq_vcn.id
  display_name   = "kraoq_security_list"

  egress_security_rules {
    protocol    = "all"
    destination = "0.0.0.0/0"
  }

  # SSH
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      max = 22
      min = 22
    }
  }

  # HTTP
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      max = 80
      min = 80
    }
  }

  # HTTPS
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      max = 443
      min = 443
    }
  }

  # K3s API
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      max = 6443
      min = 6443
    }
  }
  
  # NodePorts (Optional, for development visibility)
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      max = 32767
      min = 30000
    }
  }

  # WireGuard VPN (UDP)
  ingress_security_rules {
    protocol = "17" # UDP
    source   = "0.0.0.0/0"
    udp_options {
      max = 51820
      min = 51820
    }
  }
}

resource "oci_core_subnet" "kraoq_subnet" {
  cidr_block        = "10.0.1.0/24"
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.kraoq_vcn.id
  display_name      = "kraoq_subnet"
  dns_label         = "kraoqsub"
  security_list_ids = [oci_core_security_list.kraoq_sl.id]
  route_table_id    = oci_core_default_route_table.kraoq_rt.id
}
