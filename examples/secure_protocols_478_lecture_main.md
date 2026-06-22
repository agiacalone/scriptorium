---
title: Secure Protocols — TLS and Key Exchange
course: CECS 478
topic-slug: secure_protocols_478
term: su26
adversarial-thinking: true
type: lecture-main
visibility: public
tags: [cecs-478, teaching, security, lecture-main]
icon: LiGraduationCap
iconColor: var(--text-normal)
---

# Secure Protocols — TLS and Key Exchange

## Learning Objectives

- Explain how an ephemeral key exchange provides forward secrecy. #objective
- Describe how a downgrade attack subverts protocol negotiation. #objective

## Vocabulary

- **forward secrecy** — compromise of a long-term key does not expose past session keys #vocab #section/vocab [slide:: 2] [citation:: Stallings Ch. 17]
- **downgrade attack** — an attacker forces negotiation of a weaker protocol or cipher #vocab #section/vocab [slide:: 2] [citation:: Stallings Ch. 17]

## I. Ephemeral Key Exchange (15 min)

### Concepts

- Ephemeral Diffie-Hellman generates a fresh key pair per session, so past sessions stay secret even if the long-term key leaks. #concept #section/I [slide:: 3] [citation:: Stallings Ch. 17]
- The handshake authenticates the server (and optionally the client) before bulk data flows over the symmetric session key. #concept #section/I [slide:: 4] [citation:: Stallings Ch. 17]

### Cornell blanks

- Ephemeral Diffie-Hellman provides _______ secrecy: leaking the long-term key does not expose past sessions. #blank #section/I [slide:: 3] [answer:: forward] [citation:: Stallings Ch. 17]
- The handshake _______ the server before bulk data flows over the symmetric session key. #blank #section/I [slide:: 4] [answer:: authenticates] [citation:: Stallings Ch. 17]

## II. Protocol Attacks (15 min)

### Concepts

- A downgrade attack manipulates the negotiation step to force a weaker cipher suite that the attacker can break. #concept #section/II [slide:: 5] [citation:: Stallings Ch. 17]

### Cornell blanks

- A _______ attack forces negotiation of a weaker cipher suite the attacker can break. #blank #section/II [slide:: 5] [answer:: downgrade] [citation:: Stallings Ch. 17]

## Question Bank

### MC

- #question #type/mc #difficulty/2 #section/I #exam-eligible #adversarial [answer:: C] [points:: 2] [slide:: 3]
  Stem: Which property ensures that compromising a server's long-term private key does NOT reveal previously recorded session traffic?
  - A. Non-repudiation
  - B. Message integrity
  - C. Forward secrecy
  - D. Certificate pinning

## Self-Quiz

- #self-quiz #section/I `Q1.` Explain in one sentence why ephemeral key exchange gives forward secrecy.
- #self-quiz #section/II `Q2.` Describe how a downgrade attack defeats a protocol that still supports legacy ciphers.

## Summary

Ephemeral key exchange (DHE/ECDHE) buys forward secrecy: recorded traffic stays safe even after a long-term key leaks. Protocol negotiation is itself an attack surface — downgrade attacks coerce weaker ciphers, so secure protocols must authenticate the negotiation.

## References

- Stallings Ch. 17 — Transport-Level Security

## Slide deck source

- #slide [slide:: 1] [layout:: title] **Secure Protocols — TLS and Key Exchange** [tagline:: Forward secrecy and the negotiation attack surface.]
- #slide [slide:: 2] [layout:: vocab] **Key Terms**
  - Forward secrecy, downgrade attack
- #slide [slide:: 3] [layout:: concept] **Ephemeral Key Exchange**
  - Fresh key pair per session → forward secrecy
- #slide [slide:: 4] [layout:: concept] **The Handshake**
  - Authenticate, then switch to a symmetric session key
- #slide [slide:: 5] [layout:: concept] **Downgrade Attacks**
  - Coerce a weaker cipher suite during negotiation
