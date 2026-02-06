output "public_ip" {
  value = oci_core_instance.kraoq_server.public_ip
}

output "instance_name" {
  value = oci_core_instance.kraoq_server.display_name
}
