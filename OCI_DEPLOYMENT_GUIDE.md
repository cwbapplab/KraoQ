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
    vpn_password     = "MakeSureThisIsStrong123!"
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

## Step 5: Configure Cloudflare Tunnel

To securely expose your API without opening public ports on your Oracle instance:

1.  **Create a Tunnel**:
    *   Go to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/).
    *   Navigate to **Networks** -> **Tunnels** -> **Create a Tunnel**.
    *   Name it (e.g., `KraoQ-Remote`) and save.
2.  **Get Tunnel Token**:
    *   In the "Install and run a connector" step, copy the **Tunnel Token** (the long alphanumeric string).
3.  **Local Setup**:
    *   Add the token to your `.env` file at the project root: `CLOUDFLARE_TUNNEL_TOKEN=your_token_here`.
4.  **Configure Public Hostname**:
    *   In the Tunnel settings on Cloudflare, go to **Public Hostname** -> **Add a hostname**.
    *   **Hostname**: e.g., `api.yourdomain.com`.
    *   **Service**: Type `HTTP`, URL `kraoq-backend:80`. (Note: We use port 80 because the Kubernetes Service exposes port 80 and maps it to the container's 3001).
5.  **Security List**:
    *   Note that the Terraform configuration automatically blocks all public ingress except SSH. All app traffic now flows through this outbound tunnel.

## Step 6: GitOps Sync (ArgoCD)

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
    Copy your `backend/deployment.yaml`, `backend/pvc.yaml`, `backend/cloudflared.yaml`, and `database/deployment.yaml` to the server or apply them directly from the repo.

    *Using GitOps (ArgoCD):*
    1.  Edit `infrastructure/argocd/apps.yaml` and replace `YOUR_USERNAME` with your GitHub username.
    2.  **Important**: Edit `backend/deployment.yaml` and set `AUDIO_PROCESSOR_URL` to your Home Server's VPN IP (e.g., `http://10.X.X.X:3002`). You can see this IP in the WireGuard UI.
    3.  Commit and push these changes.
    4.  Apply the manifests:
    ```bash
    # 1. Create Kubernetes Secret
    kubectl create secret generic kraoq-secrets \
      --from-literal=mongo-root-username=admin \
      --from-literal=mongo-root-password=YourSecureMongoPassword123 \
      --from-literal=google-client-id=YOUR_GOOGLE_CLIENT_ID \
      --from-literal=google-client-secret=YOUR_GOOGLE_CLIENT_SECRET \
      --from-literal=session-secret=MakeThisALongRandomString \
      --from-literal=audio-processor-api-key=your_secure_api_key_here \
      --from-literal=CLOUDFLARE_TUNNEL_TOKEN=your_token_here
      
    # 3. Create Storage and Cloudflare Tunnel Agent
    kubectl apply -f https://raw.githubusercontent.com/YOUR_USERNAME/KraoQ/main/backend/pvc.yaml
    kubectl apply -f https://raw.githubusercontent.com/YOUR_USERNAME/KraoQ/main/backend/cloudflared.yaml
      
    # 4. Connect ArgoCD to your repo
    kubectl apply -f https://raw.githubusercontent.com/YOUR_USERNAME/KraoQ/main/infrastructure/argocd/apps.yaml
    ```
    4.  ArgoCD will automatically detect the apps and sync them to your cluster.

## Credentials Reference

The following sensitive credentials must be managed manually (either via the K8s Secret command above or **Oracle Cloud Vault** if you implement external-secrets):

| Credential | Key in Secret | Purpose |
| :--- | :--- | :--- |
| **MongoDB Root User** | `mongo-root-username` | Database Admin User |
| **MongoDB Root Pass** | `mongo-root-password` | Database Admin Password |
| **Audio Processor Key** | `audio-processor-api-key` | API Key to authenticate with your home Audio Processor |
| **Google Client ID** | `google-client-id` | OAuth 2.0 Client ID for Login |
| **Google Client Secret** | `google-client-secret` | OAuth 2.0 Client Secret for Login |
| **Session Secret** | `session-secret` | Key to sign session cookies |
| **Cloudflare Token** | `CLOUDFLARE_TUNNEL_TOKEN` | Token to connect the Cloudflare Tunnel |

## Initial Setup: Google OAuth

To enable "Sign in with Google":
1.  Go to [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a Project -> **APIs & Services** -> **Credentials**.
3.  Create Credentials -> **OAuth Client ID** -> **Web Application**.
4.  **Authorized Redirect URIs**: `https://api.yourdomain.com/auth/google/callback` (Use the actual domain configured in Cloudflare).
5.  Copy the **Client ID** and **Client Secret** for the command above.

## Step 7: Connect via VPN (WireGuard)

To securely access your cluster (and for your local Audio Processor to talk to it, or vice versa if using a site-to-site setup):

1.  **Secure Web UI Access**: The admin UI (port 51821) is **not** exposed to the internet for security. Access it via SSH Tunnel:
    ```bash
    ssh -L 51821:localhost:51821 opc@<public_ip>
    ```
    Then open `http://localhost:51821` in your browser.
2.  **Login**: Use the password configured in `cloud-init.yaml` (Default: `kraoq_vpn_secret`).
3.  **Create Client**: Click "New Client", give it a name (e.g., "HomeServer").
4.  **Connect**: Download the `.conf` file or scan the QR code.
    *   **On your local machine**: Import the `.conf` into the WireGuard client and activate requirements.
5.  **Verify**: You should now be able to ping the internal cluster network (10.0.0.x).
