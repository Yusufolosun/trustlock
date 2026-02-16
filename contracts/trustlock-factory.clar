;; TrustLock Factory
;; Deploys and manages escrow contract instances

;; ========================================
;; IMPORTS
;; ========================================

;; Import escrow trait
(use-trait escrow-trait .trustlock-traits.escrow-trait)

;; ========================================
;; DATA STRUCTURES
;; ========================================

;; Registry of deployed escrows
;; Maps escrow-id to creator address
(define-map escrow-registry
  { escrow-id: uint }
  { 
    creator: principal,
    buyer: principal,
    seller: principal,
    amount: uint,
    deadline: uint,
    created-at: uint
  }
)

;; Escrow counter
(define-data-var escrow-count uint u0)

;; Track escrows by creator
(define-map creator-escrows
  { creator: principal }
  { escrow-ids: (list 100 uint) }
)

;; ========================================
;; PRIVATE HELPER FUNCTIONS
;; ========================================

;; Get next escrow ID
(define-private (get-next-id)
  (let ((current-id (var-get escrow-count)))
    (var-set escrow-count (+ current-id u1))
    current-id
  )
)

;; Add escrow to creator's list
(define-private (add-to-creator-list (creator principal) (escrow-id uint))
  (match (map-get? creator-escrows { creator: creator })
    existing-data
      (map-set creator-escrows
        { creator: creator }
        { escrow-ids: (unwrap-panic (as-max-len? (append (get escrow-ids existing-data) escrow-id) u100)) }
      )
    ;; First escrow for this creator
    (map-set creator-escrows
      { creator: creator }
      { escrow-ids: (list escrow-id) }
    )
  )
)
