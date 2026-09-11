# Self-Hosted SIEM with Wazuh

Running a SIEM for a small business doesn't have to mean a big budget or a
cloud bill. Wazuh is an open-source security platform that turns one decent
server into a working intrusion-detection setup.

## What Wazuh monitors

Wazuh watches file integrity, collects log data from agents, and detects
changes in configuration. It ships with a dashboard that shows active alerts,
so a single admin can spot a brute-force attempt or a modified binary without
standing up a commercial SIEM.

## Why self-hosted

For an SME, self-hosting means the security telemetry stays on your own
hardware. No data leaves your network. That matters for regulated industries
where sending logs to a third party is itself a compliance problem.

## Getting started

Deploy the Wazuh manager as a container, install the agent on each endpoint,
then point the agent at the manager's IP. Within minutes you get file-integrity
logs, syslog ingestion, and a growing rule set surfaced in the dashboard.

The trade-off is maintenance: updates, disk for log storage, and tuning rules
so your alerts don't drown in noise. Give the rule-set a week to find its
level before you trust the dashboard.