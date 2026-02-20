;; TrustLock Traits
;; Interface definitions for escrow contracts

;; ========================================
;; ERROR CODES
;; ========================================

;; Authorization Errors (u100-u199)
(define-constant ERR-NOT-BUYER (err u100))
(define-constant ERR-NOT-SELLER (err u101))
(define-constant ERR-NOT-PARTY (err u102))
(define-constant ERR-UNAUTHORIZED (err u103))
(define-constant ERR-NOT-FACTORY (err u104))
(define-constant ERR-NOT-OWNER (err u105))

;; State Errors (u200-u299)
(define-constant ERR-ALREADY-FUNDED (err u200))
(define-constant ERR-NOT-FUNDED (err u201))
(define-constant ERR-ALREADY-RELEASED (err u202))
(define-constant ERR-ALREADY-REFUNDED (err u203))
(define-constant ERR-INVALID-STATE (err u204))
(define-constant ERR-CONTRACT-PAUSED (err u206))

;; Validation Errors (u300-u399)
(define-constant ERR-INVALID-AMOUNT (err u300))
(define-constant ERR-DEADLINE-PASSED (err u301))
(define-constant ERR-DEADLINE-NOT-REACHED (err u302))
(define-constant ERR-AMOUNT-MISMATCH (err u303))
(define-constant ERR-AMOUNT-TOO-LOW (err u304))
(define-constant ERR-DEADLINE-TOO-LONG (err u305))

;; Execution Errors (u400-u499)
(define-constant ERR-TRANSFER-FAILED (err u400))
(define-constant ERR-INSUFFICIENT-BALANCE (err u401))

;; ========================================
;; TRAIT DEFINITIONS
;; ========================================

;; Escrow Trait
;; Standard interface for all escrow contract implementations
(define-trait escrow-trait
  (
    ;; Deposit funds into escrow
    ;; @param amount: Amount of STX to deposit (in micro-STX)
    ;; @returns (ok true) on success, error code on failure
    (deposit (uint) (response bool uint))
    
    ;; Release escrowed funds to seller
    ;; Can only be called by seller
    ;; @returns (ok true) on success, error code on failure
    (release () (response bool uint))
    
    ;; Refund escrowed funds to buyer
    ;; Can only be called after deadline has passed
    ;; @returns (ok true) on success, error code on failure
    (refund () (response bool uint))
    
    ;; Get current escrow information
    ;; @returns Escrow details or error code
    (get-info () (response {
      buyer: principal,
      seller: principal,
      amount: uint,
      status: (string-ascii 20),
      deadline: uint,
      funded-at: (optional uint)
    } uint))
  )
)
