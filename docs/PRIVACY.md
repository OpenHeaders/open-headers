# Privacy Policy for Open Headers

**Effective Date: July 11, 2026**

## Introduction

Open Headers is committed to protecting your privacy and ensuring transparency about how our software operates. This Privacy Policy explains our data practices for the Open Headers browser extension and companion app.

## 1. Overview

Open Headers consists of:
- A browser extension for managing HTTP headers (available for Chrome, Firefox, Edge, and Safari)
- An optional companion desktop application for accessing local system resources

Every network call the software can make is publicly documented byte-for-byte in our wire-transparency documentation, so our privacy claims can be verified from the outside — with browser DevTools or a system-level packet capture — without trusting us.

## 2. Information Collection and Use

### What We Collect

**We Do Not Collect:**
- Personal information
- Usage statistics
- Browsing history
- Header values or content
- Any data from your computer

**Local Storage Only:**
- Your header configurations are stored locally in your browser using the browser's storage API
- Dynamic header sources accessed through the companion app remain on your local device
- No data is transmitted to our servers or third parties

### How Information is Used

All configuration data is used solely for the functioning of the extension and remains on your device. We have no access to this information.

## 3. Data Sharing and Transfer

We do not collect or share any user data with third parties, as we do not collect any data in the first place.

## 4. Local Communication

The browser extension and companion app communicate locally via WebSocket on port 59210. This connection:
- Is limited to localhost (127.0.0.1)
- Does not transmit data over the internet
- Requires explicit user action to enable
- Uses a simple JSON-based protocol for requesting and receiving header values

## 5. Permissions

The extension requires certain permissions to function:

- **storage**: To save your header configurations
- **alarms**: For scheduling header updates
- **scripting**: To initialize extension functionality
- **declarativeNetRequest**: To modify HTTP headers
- **host_permissions** (`<all_urls>`): To modify headers for your specified domains

These permissions are used solely for the extension's core header modification functionality and not for collecting information.

## 6. Security

We prioritize security through:
- Local-only data storage
- No external network connections beyond documented endpoints (license renewal, update checks, notification manifests) and destinations you configure yourself
- Publicly documented wire behavior that anyone can verify with a packet capture
- Regular security updates and a published vulnerability disclosure policy

## 7. Children's Privacy

Open Headers is a developer tool and not intended for use by children under 13 years of age.

## 8. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify users of any changes by updating the "Effective Date" at the top of this policy.

## 9. Transparency Commitment

Open Headers is proprietary software with a verifiable privacy posture. We publish:
- A wire-transparency specification documenting the exact payload of every network call the software can make
- A security whitepaper describing the architecture behind these guarantees
- A vulnerability disclosure policy

Because the software's outbound behavior is fully documented, you can verify our privacy claims yourself with browser DevTools or a system-level packet capture — no source access or trust in us required.

## 10. Contact Information

If you have questions about this Privacy Policy or the Open Headers project, please:
- Create an issue at https://github.com/OpenHeaders/open-headers-releases
- Email us at contact@openheaders.io

We welcome feedback on both our software and our policies.

## 11. Consent

By using Open Headers, you consent to this Privacy Policy. As we do not collect any personal information, there is no data to manage or delete.

This Privacy Policy is provided to meet browser extension store requirements and to be transparent about our commitment to privacy and data security.