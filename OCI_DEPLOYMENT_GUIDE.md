# OCI Deployment Guide

This guide details how to host the **KraoQ Backend** and **Database** on Oracle Cloud Infrastructure (OCI) Always Free Tier using the automation scripts provided.

## Prerequisites

1.  **Oracle Cloud Account**: Sign up for an [Oracle Cloud Free Tier](https://signup.cloud.oracle.com/) account.
2.  **Terraform**: Install [Terraform](https://developer.hashicorp.com/terraform/downloads).
3.  **GitHub Repository**: Ensure your code is pushed to GitHub.

## Step 1: Gather Credentials

You need the following OCI identifiers:
1.  **Tenancy OCID**: Profile -> Tenancy.
2.  **User OCID**: Profile -> User Settings.
3.  **API Key**: Profile -> User Settings -> API Keys -> Add API Key.
    *   Download the Private Key (`.pem`).
    *   Note the **Fingerprint**.
4.  **Region**: (e.g., `us-ashburn-1`).
5.  **Compartment OCID**: Identity & Security -> Compartments (usually same as Tenancy for root).

## Step 2: Configure Terraform

1.  Navigate to `infrastructure/terraform`.
2.  Create a file named `terraform.tfvars`:
    ```hcl
    tenancy_ocid     = "ocid1.tenancy.oc1..."
    user_ocid        = "ocid1.user.oc1..."
    fingerprint      = "xx:xx:xx..."
    private_key_path = "C:/path/to/your/oci_api_key.pem"
    region           = "us-ashburn-1"
    compartment_ocid = "ocid1.tenancy.oc1..."
    ssh_public_key   = "ssh-rsa AAAAB3..."
    ```
    > [!WARNING]
    > Never commit `terraform.tfvars` or your `.pem` key to Git!

## Step 3: Run Infrastructure Automation

1.  Initialize Terraform:
    ```bash
    terraform init
    ```
2.  Preview changes:
    ```bash
    terraform plan
    ```
3.  Apply (creates VM + Networking + K3s):
    ```bash
    terraform apply
    ```
    *   Type `yes` to confirm.
    *   Takes ~5-10 minutes.
    *   **Output**: `public_ip` (e.g., `123.45.67.89`).

## Step 4: Configure GitHub Actions (CI/CD)

To enable the auto-deployment pipeline:

1.  Go to your GitHub Repo -> **Settings** -> **Actions** -> **General**.
2.  Under **Workflow permissions**, select **Read and write permissions**.
3.  Push a commit to the `backend` folder.
    *   The `Deploy Backend` workflow will trigger.
    *   It builds the Docker image and pushes to `ghcr.io/your-user/kraoq-backend`.
    *   It updates `backend/deployment.yaml` with the new tag.

## Step 5: GitOps Sync (ArgoCD)

The Cloud-init script installed K3s and ArgoCD.

1.  **SSH into your server**:
    ```bash
    ssh opc@<public_ip>
    ```
2.  **Check Status**:
    ```bash
    kubectl get nodes
    kubectl get pods -n argocd
    ```
3.  **Deploy Application**:
    Copy your `backend/deployment.yaml` and `database/deployment.yaml` to the server or apply them directly from the repo using ArgoCD (requires ArgoCD UI setup).

    *For simple start, apply directly via kubectl:*
    ```bash
    # Create secret
    kubectl create secret generic kraoq-secrets \
      --from-literal=mongo-root-username=admin \
      --from-literal=mongo-root-password=password123
    
    # Apply manifests (you can clone your repo on the server)
    git clone https://github.com/your-user/KraoQ.git
    kubectl apply -f KraoQ/backend/deployment.yaml
    kubectl apply -f KraoQ/database/deployment.yaml
    ```
