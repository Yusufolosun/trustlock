;; TrustLock Factory
;; Deploys and manages escrow contract instances

;; ========================================
;; IMPORTS
;; ========================================



;; ========================================
;; CONSTANTS
;; ========================================

;; Error codes (mirrored from trustlock-traits for local use)
(define-constant ERR-UNAUTHORIZED (err u103))
(define-constant ERR-NOT-FOUND (err u201))
(define-constant ERR-INVALID-AMOUNT (err u300))
(define-constant ERR-DEADLINE-PASSED (err u301))

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
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (> deadline-blocks u0) ERR-DEADLINE-PASSED)
    (asserts! (not (is-eq buyer seller)) ERR-UNAUTHORIZED)
    
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

;; ========================================
;; READ-ONLY FUNCTIONS - QUERIES
;; ========================================

;; Get escrow info from registry
(define-read-only (get-escrow-info (escrow-id uint))
  (map-get? escrow-registry { escrow-id: escrow-id })
)

;; Get all escrows created by a principal
(define-read-only (get-creator-escrows (creator principal))
  (default-to 
    { escrow-ids: (list) }
    (map-get? creator-escrows { creator: creator })
  )
)

;; Get total number of escrows created
(define-read-only (get-total-escrows)
  (ok (var-get escrow-count))
)

;; Check if escrow exists in registry
(define-read-only (escrow-exists (escrow-id uint))
  (is-some (map-get? escrow-registry { escrow-id: escrow-id }))
)

;; Get escrow details with live status
;; Combines registry data with escrow contract state
(define-read-only (get-full-escrow-details (escrow-id uint))
  (match (get-escrow-info escrow-id)
    registry-data
      (match (contract-call? .trustlock-escrow get-info escrow-id)
        escrow-data
          (ok {
            registry: registry-data,
            state: escrow-data
          })
        error (err error)
      )
    ERR-NOT-FOUND
  )
)

;; ========================================
;; READ-ONLY FUNCTIONS - BATCH QUERIES
;; ========================================

;; Get multiple escrow details at once
;; Useful for pagination in frontend
(define-read-only (get-escrows-batch (escrow-ids (list 20 uint)))
  (ok (map get-escrow-info escrow-ids))
)

;; Get pagination info for recent escrows
;; Returns the start index and total for client-side querying
(define-read-only (get-recent-escrows-page (count uint))
  (let (
    (total (var-get escrow-count))
    (start (if (> total count) (- total count) u0))
  )
    (ok { start: start, total: total })
  )
)

;; ========================================
;; READ-ONLY FUNCTIONS - STATISTICS
;; ========================================

;; Get factory statistics
(define-read-only (get-factory-stats)
  (ok {
    total-escrows: (var-get escrow-count),
    contract-deployed-at: block-height ;; Approximation
  })
)

;; Get creator statistics
(define-read-only (get-creator-stats (creator principal))
  (let (
    (creator-data (get-creator-escrows creator))
    (creator-count (len (get escrow-ids creator-data)))
  )
    (ok {
      total-created: creator-count,
      escrow-ids: (get escrow-ids creator-data)
    })
  )
)
