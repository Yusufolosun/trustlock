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

;; ========================================
;; PUBLIC FUNCTIONS - DEPLOYMENT
;; ========================================

;; Create new escrow instance
;; @param buyer: Buyer principal address
;; @param seller: Seller principal address
;; @param amount: Escrow amount in micro-STX
;; @param deadline-blocks: Number of blocks until refund allowed
;; @returns escrow-id on success
(define-public (create-escrow
  (buyer principal)
  (seller principal)
  (amount uint)
  (deadline-blocks uint))
  (let (
    (escrow-id (get-next-id))
    (deadline (+ block-height deadline-blocks))
  )
    ;; Validate inputs
    (asserts! (> amount u0) (err u300)) ;; ERR-INVALID-AMOUNT
    (asserts! (> deadline-blocks u0) (err u301)) ;; ERR-DEADLINE-PASSED
    (asserts! (not (is-eq buyer seller)) (err u103)) ;; ERR-UNAUTHORIZED
    
    ;; Register escrow in factory
    (map-set escrow-registry
      { escrow-id: escrow-id }
      {
        creator: tx-sender,
        buyer: buyer,
        seller: seller,
        amount: amount,
        deadline: deadline,
        created-at: block-height
      }
    )
    
    ;; Add to creator's list
    (add-to-creator-list tx-sender escrow-id)
    
    ;; Initialize escrow in the escrow contract
    (try! (contract-call? .trustlock-escrow initialize-escrow buyer seller amount deadline-blocks))
    
    (ok escrow-id)
  )
)
