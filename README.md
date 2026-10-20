<div align="center">

# demo-backstage-crossplane-argo

Local platform-engineering demo: Crossplane manages infra, ArgoCD does GitOps, Backstage is the self-service front door — all in a single `kind` cluster.

[![License](https://img.shields.io/github/license/ditwrd/demo-backstage-crossplane-argo?style=for-the-badge)](https://github.com/ditwrd/demo-backstage-crossplane-argo/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/ditwrd/demo-backstage-crossplane-argo?style=for-the-badge)](https://github.com/ditwrd/demo-backstage-crossplane-argo/stargazers)

</div>

## What is this?

A `kind` cluster wired end-to-end: Crossplane composes an `XS3Bucket` claim into a real (mocked) AWS S3 bucket, ArgoCD reconciles everything under `crossplane/` via an app-of-apps, and Backstage exposes the XRD as a self-service scaffolder template so a claim can be created from a web form and land as a PR. AWS calls are mocked locally through [ministack](https://github.com/ministackorg/ministack) — no real cloud account needed.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for `kind`)
- [mise](https://mise.jdx.dev/) to install pinned tool versions

## Quick Start

**1. Install tools**

```sh
mise install
```

Installs the versions pinned in `mise.toml`: `kind`, `helmfile`, `crossplane`, `kubectx`, `node`, and `yarn`.

**2. Create the cluster**

```sh
kind create cluster --config kind.yaml
```

Creates cluster `demobca` (kubeconfig context `kind-demobca`).

If pods can't resolve external names (`kubectl run -it --rm --image=busybox:1.36 --restart=Never t -- nslookup pypi.org` fails), the kind node's resolver points at a docker gateway with no DNS listener. StackPort installs itself from PyPI at pod start, so point CoreDNS at public resolvers first:

```sh
kubectl -n kube-system get cm coredns -o json \
  | jq '.data.Corefile |= sub("forward \\. /etc/resolv.conf"; "forward . 1.1.1.1 8.8.8.8")' \
  | kubectl apply -f - && kubectl -n kube-system rollout restart deploy/coredns
```

**3. (optional) Preload the ArgoCD image**

Skips a slow pull during `helmfile apply`:

```sh
docker pull quay.io/argoproj/argocd:v3.5.0
kind load docker-image quay.io/argoproj/argocd:v3.5.0 --name demobca
```

**4. Install the platform stack**

```sh
helmfile apply
```

Installs ArgoCD (`argo` namespace), Crossplane core (`crossplane-system`), and ministack (`ministack` namespace, mocks S3/SQS/IAM on port 4566).

**5. Bootstrap ArgoCD (app-of-apps)**

```sh
kubectl apply -f argo/bootstrap/
```

This applies the `demo-bca` AppProject and root Application, which then syncs the three ApplicationSets in `argo/application-set/` — installing Crossplane Providers (`crossplane/providers/`), XRD/Composition modules (`crossplane/modules/`), and XR instances (`crossplane/resources/`).

**6. Apply the manual provider credentials**

`crossplane/providers/aws-config.manual.yml` is deliberately excluded from GitOps (its `.yml` extension doesn't match the ApplicationSet's `*.yaml` glob) since it carries the mock AWS credentials Secret. Apply it once the AWS provider package is `Healthy`:

```sh
kubectl wait provider.pkg.crossplane.io/upbound-provider-aws-s3 --for=condition=Healthy --timeout=120s
kubectl apply -f crossplane/providers/aws-config.manual.yml
```

**7. Access ArgoCD**

```sh
kubectl -n argo get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
kubectl -n argo port-forward svc/argo-argocd-server 8080:80
```

Open http://localhost:8080, log in as `admin` with the password above.

**8. Access ministack**

```sh
kubectl -n ministack port-forward svc/ministack-kubedeploy 4566:4566 &
kubectl -n ministack port-forward svc/stackport-kubedeploy 8081:8080
```

Open http://localhost:8081 for StackPort. It runs in-cluster (uv image, `stackport` fetched at pod start, so first boot needs a minute) and talks to ministack with dummy credentials, so your local AWS profile is never used. Port 4566 also matches `AWS_ENDPOINT_URL` in `mise.toml`, so any AWS CLI/SDK call made locally routes to the mock automatically.

**9. (optional) Run Backstage**

Backstage's `localKubectlProxy` cluster locator reaches the cluster through `kubectl proxy` on :8001. Start it first — if Backstage boots without it, the ingestor's first run fails and the next sync is ~10 minutes out.

```sh
kubectl proxy --port=8001 &
cd backstage
yarn install
GITHUB_TOKEN=<a token with repo scope> yarn start
```

Frontend on http://localhost:3000, backend on :7007. Sign in as guest, then check `/` for ingested Crossplane claims and `/create` for the `XS3Bucket` scaffolder template — submitting it opens a PR against this repo under `crossplane/resources/aws/`.

## Project Structure

```
argo/
  application-set/    # ApplicationSets: modules, providers, resources
  bootstrap/           # App-of-apps entrypoint (AppProject + root Application)
backstage/
  examples/            # Backstage org data
  packages/            # app (frontend) + backend
  plugins/
crossplane/
  modules/             # XRD + Composition per provider/resource
  providers/           # Crossplane Provider packages + ProviderConfig
  resources/           # XR claim instances (synced by ArgoCD)
LICENSE
README.md
helmfile.yaml          # ArgoCD, Crossplane core, ministack
kind.yaml              # kind cluster config
mise.toml              # pinned tool versions
scratch.md             # working notes
```

## Documentation

| Resource | Description |
|----------|-------------|
| `argo/bootstrap/` | App-of-apps entrypoint — apply this once, everything else follows |
| `argo/application-set/` | The three ApplicationSets driving GitOps sync |
| `crossplane/modules/` | XRD + Composition definitions (add a new resource type here) |
| `crossplane/resources/` | Live XR instances — what Backstage's scaffolder writes to |
| `backstage/app-config.yaml` | `kubernetesIngestor` config: claim/XRD ingestion, GitHub publish target |

## Troubleshooting

**`dial tcp: lookup 000000000000.<host>: no such host` on the AWS provider.** The AWS SDK prefixes S3 Control calls with a synthetic account ID (`000000000000`, since STS is disabled), generating a hostname with no DNS entry. This is handled automatically: an `initContainer` resolves ministack's real ClusterIP at pod startup and aliases the prefixed hostname in `/etc/hosts`. If you still see this error, check that the `resolve-ministack-ip` initContainer completed (the AWS S3 provider pod should show `Init:0/1` briefly, then `1/1 Running`) and that ministack's Service DNS is reachable from the `crossplane-system` namespace.

## Contributing

Contributions welcome — open an issue or PR.

<a href="https://github.com/ditwrd/demo-backstage-crossplane-argo/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ditwrd/demo-backstage-crossplane-argo" alt="Contributors" />
</a>

## License

[GPL-3.0](LICENSE)
