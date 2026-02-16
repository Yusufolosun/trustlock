;; TrustLock Escrow
;; Core escrow logic for two-party transactions

;; ========================================
;; CONSTANTS
;; ========================================

;; Status strings
(define-constant STATUS-CREATED "CREATED")
(define-constant STATUS-FUNDED "FUNDED")
(define-constant STATUS-RELEASED "RELEASED")
(define-constant STATUS-REFUNDED "REFUNDED")

;; Import error codes from traits contract
(use-trait escrow-trait .trustlock-traits.escrow-trait)

;; ========================================
;; DATA STRUCTURES
;; ========================================

;; Escrow data map
;; Stores all escrow information indexed by escrow-id
(define-map escrows
  { escrow-id: uint }
  {
    buyer: principal,
    seller: principal,
    amount: uint,
    deadline: uint,
    status: (string-ascii 10),
    funded-at: (optional uint)
  }
)

;; Escrow counter for unique IDs
(define-data-var escrow-nonce uint u0)

;; ========================================
;; PRIVATE HELPER FUNCTIONS
;; ========================================

;; Get next escrow ID and increment nonce
(define-private (get-next-escrow-id)
  (let ((current-id (var-get escrow-nonce)))
    (var-set escrow-nonce (+ current-id u1))
    current-id
  )
)

;; Get escrow data by ID
(define-read-only (get-escrow (escrow-id uint))
  (map-get? escrows { escrow-id: escrow-id })
)
