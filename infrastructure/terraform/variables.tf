variable "tenancy_ocid" {}
variable "user_ocid" {}
variable "fingerprint" {}
variable "private_key_path" {}
variable "region" {}
variable "compartment_ocid" {}
variable "ssh_public_key" {}

variable "instance_shape" {
  default = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  default = 4
}

variable "instance_memory_in_gbs" {
  default = 24
}

variable "cloudflare_tunnel_token" {
  type      = string
  sensitive = true
}
