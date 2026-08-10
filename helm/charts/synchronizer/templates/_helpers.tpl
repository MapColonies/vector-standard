{{- define "synchronizer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "synchronizer.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "synchronizer.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "synchronizer.labels" -}}
helm.sh/chart: {{ include "synchronizer.chart" . }}
{{ include "synchronizer.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ include "mclabels.labels" . }}
{{- end }}

{{- define "synchronizer.selectorLabels" -}}
app.kubernetes.io/name: {{ include "synchronizer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{ include "mclabels.selectorLabels" . }}
{{- end }}

{{- define "synchronizer.tag" -}}
{{- default (printf "v%s" .Chart.AppVersion) .Values.image.tag }}
{{- end }}

{{- define "synchronizer.cloudProviderFlavor" -}}
{{-  if .Values.cloudProvider -}}
    {{- .Values.cloudProvider.flavor | default "minikube" -}}
{{- else -}}
    {{ "minikube" }}
{{- end -}}
{{- end -}}

{{- define "synchronizer.cloudProviderDockerRegistryUrl" -}}
{{-  if .Values.cloudProvider.dockerRegistryUrl -}}
    {{- printf "%s/" .Values.cloudProvider.dockerRegistryUrl -}}
{{- else -}}
{{- end -}}
{{- end -}}

{{- define "synchronizer.cloudProviderImagePullSecretName" -}}
{{-  if .Values.cloudProvider.imagePullSecretName -}}
    {{- .Values.cloudProvider.imagePullSecretName -}}
{{- end -}}
{{- end -}}

{{- define "synchronizer.tracingUrl" -}}
{{- if .Values.global.tracing.url }}
    {{- .Values.global.tracing.url -}}
{{- else -}}
    {{- .Values.env.tracing.url -}}
{{- end -}}
{{- end -}}

{{- define "synchronizer.metricsUrl" -}}
{{- if .Values.global.metrics.url }}
    {{- .Values.global.metrics.url -}}
{{- else -}}
    {{- .Values.env.metrics.url -}}
{{- end -}}
{{- end -}}

{{- define "synchronizer.dbEnvBlock" -}}
{{- $p := .prefix -}}
{{- with .db }}
{{ $p }}_HOST: {{ .host | quote }}
{{ $p }}_PORT: {{ .port | quote }}
{{ $p }}_USERNAME: {{ .username | quote }}
{{ $p }}_NAME: {{ .database | quote }}
{{ $p }}_SCHEMA: {{ .schema | quote }}
{{ $p }}_TYPE: {{ .type | quote }}
{{ $p }}_ENABLE_SSL_AUTH: {{ .sslAuth.enabled | quote }}
{{- if .sslAuth.enabled }}
{{ $p }}_CA_PATH: {{ .sslAuth.root | quote }}
{{ $p }}_CERT_PATH: {{ .sslAuth.cert | quote }}
{{ $p }}_KEY_PATH: {{ .sslAuth.key | quote }}
{{- end }}
{{- end }}
{{- end }}
