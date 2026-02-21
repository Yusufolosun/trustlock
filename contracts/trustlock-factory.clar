;; TrustLock Factory
;; Deploys and manages escrow contract instances

;; ========================================
;; IMPORTS
;; ========================================



;; ========================================
;; CONSTANTS
;; ========================================

;; Contract owner (deployer) - can pause/unpause
(define-constant CONTRACT-OWNER tx-sender)

;; Error codes (mirrored from trustlock-traits for local use)
(define-constant ERR-UNAUTHORIZED (err u103))
(define-constant ERR-NOT-OWNER (err u105))
(define-constant ERR-NOT-FOUND (err u201))
(define-constant ERR-CONTRACT-PAUSED (err u206))
(define-constant ERR-INVALID-AMOUNT (err u300))
(define-constant ERR-DEADLINE-PASSED (err u301))
(define-constant ERR-AMOUNT-TOO-LOW (err u304))
(define-constant ERR-DEADLINE-TOO-LONG (err u305))

;; Bounds (must match escrow contract)
(define-constant MIN-ESCROW-AMOUNT u1000)
(define-constant MAX-DEADLINE-BLOCKS u52560)

;; Per-creator page size for escrow-id lists
(define-constant PAGE-SIZE u50)

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

;; Emergency pause flag
(define-data-var is-paused bool false)

;; Track escrows by creator - paginated to avoid list overflow.
;; Each page holds up to PAGE-SIZE (50) escrow IDs.
(define-map creator-escrow-pages
  { creator: principal, page: uint }
  { escrow-ids: (list 50 uint) }
)

;; Per-creator metadata: total count and current (latest) page index.
(define-map creator-info
  { creator: principal }
  { total-count: uint, current-page: uint }
)

;; Track escrows by buyer - paginated like creator lists.
(define-map buyer-escrow-pages
  { buyer: principal, page: uint }
  { escrow-ids: (list 50 uint) }
)

(define-map buyer-info
  { buyer: principal }
  { total-count: uint, current-page: uint }
)

;; Track escrows by seller - paginated like creator lists.
(define-map seller-escrow-pages
  { seller: principal, page: uint }
  { escrow-ids: (list 50 uint) }
)

(define-map seller-info
  { seller: principal }
  { total-count: uint, current-page: uint }
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

;; Add escrow to creator's paginated list.
;; When the current page is full, a new page is started automatically.
(define-private (add-to-creator-list (creator principal) (escrow-id uint))
  (let (
    (info (default-to { total-count: u0, current-page: u0 }
            (map-get? creator-info { creator: creator })))
    (current-page (get current-page info))
    (total-count (get total-count info))
    (page-data (default-to { escrow-ids: (list) }
                 (map-get? creator-escrow-pages { creator: creator, page: current-page })))
    (current-ids (get escrow-ids page-data))
  )
    (if (< (len current-ids) PAGE-SIZE)
      ;; Room on current page - append
      (begin
        (map-set creator-escrow-pages
          { creator: creator, page: current-page }
          { escrow-ids: (unwrap-panic (as-max-len? (append current-ids escrow-id) u50)) })
        (map-set creator-info
          { creator: creator }
          { total-count: (+ total-count u1), current-page: current-page })
        true
      )
      ;; Current page full - start new page
      (let ((new-page (+ current-page u1)))
        (map-set creator-escrow-pages
          { creator: creator, page: new-page }
          { escrow-ids: (list escrow-id) })
        (map-set creator-info
          { creator: creator }
          { total-count: (+ total-count u1), current-page: new-page })
        true
      )
    )
  )
)

;; Add escrow to a buyer's paginated list.
(define-private (add-to-buyer-list (the-buyer principal) (escrow-id uint))
  (let (
    (info (default-to { total-count: u0, current-page: u0 }
            (map-get? buyer-info { buyer: the-buyer })))
    (current-page (get current-page info))
    (total-count (get total-count info))
    (page-data (default-to { escrow-ids: (list) }
                 (map-get? buyer-escrow-pages { buyer: the-buyer, page: current-page })))
    (current-ids (get escrow-ids page-data))
  )
    (if (< (len current-ids) PAGE-SIZE)
      (begin
        (map-set buyer-escrow-pages
          { buyer: the-buyer, page: current-page }
          { escrow-ids: (unwrap-panic (as-max-len? (append current-ids escrow-id) u50)) })
        (map-set buyer-info
          { buyer: the-buyer }
          { total-count: (+ total-count u1), current-page: current-page })
        true
      )
      (let ((new-page (+ current-page u1)))
        (map-set buyer-escrow-pages
          { buyer: the-buyer, page: new-page }
          { escrow-ids: (list escrow-id) })
        (map-set buyer-info
          { buyer: the-buyer }
          { total-count: (+ total-count u1), current-page: new-page })
        true
      )
    )
  )
)

;; Add escrow to a seller's paginated list.
(define-private (add-to-seller-list (the-seller principal) (escrow-id uint))
  (let (
    (info (default-to { total-count: u0, current-page: u0 }
            (map-get? seller-info { seller: the-seller })))
    (current-page (get current-page info))
    (total-count (get total-count info))
    (page-data (default-to { escrow-ids: (list) }
                 (map-get? seller-escrow-pages { seller: the-seller, page: current-page })))
    (current-ids (get escrow-ids page-data))
  )
    (if (< (len current-ids) PAGE-SIZE)
      (begin
        (map-set seller-escrow-pages
          { seller: the-seller, page: current-page }
          { escrow-ids: (unwrap-panic (as-max-len? (append current-ids escrow-id) u50)) })
        (map-set seller-info
          { seller: the-seller }
          { total-count: (+ total-count u1), current-page: current-page })
        true
      )
      (let ((new-page (+ current-page u1)))
        (map-set seller-escrow-pages
          { seller: the-seller, page: new-page }
          { escrow-ids: (list escrow-id) })
        (map-set seller-info
          { seller: the-seller }
          { total-count: (+ total-count u1), current-page: new-page })
        true
      )
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
    ;; Pause check
    (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED)

    ;; Validate inputs
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= amount MIN-ESCROW-AMOUNT) ERR-AMOUNT-TOO-LOW)
    (asserts! (> deadline-blocks u0) ERR-DEADLINE-PASSED)
    (asserts! (<= deadline-blocks MAX-DEADLINE-BLOCKS) ERR-DEADLINE-TOO-LONG)
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
    
    ;; Add to creator's, buyer's, and seller's lists
    (add-to-creator-list tx-sender escrow-id)
    (add-to-buyer-list buyer escrow-id)
    (add-to-seller-list seller escrow-id)
    
    ;; Initialize escrow in the escrow contract (factory owns the ID)
    (try! (contract-call? .trustlock-escrow initialize-escrow escrow-id buyer seller amount deadline-blocks))
    
    (ok escrow-id)
  )
)

;; ========================================
;; PUBLIC FUNCTIONS - CANCELLATION
;; ========================================

;; Cancel an escrow that has not been funded yet
;; Only the original creator can cancel through the factory
;; @param escrow-id: ID of the escrow to cancel
;; @returns (ok true) on success, error code on failure
(define-public (cancel-escrow (escrow-id uint))
  (let (
    (registry-data (unwrap! (get-escrow-info escrow-id) ERR-NOT-FOUND))
    (creator (get creator registry-data))
  )
    ;; Pause check
    (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED)

    ;; Only the original creator can cancel via factory
    (asserts! (is-eq tx-sender creator) ERR-UNAUTHORIZED)

    ;; Delegate to escrow contract (it enforces the CREATED status check)
    (try! (contract-call? .trustlock-escrow cancel-escrow escrow-id))

    (ok true)
  )
)

;; ========================================
;; READ-ONLY FUNCTIONS - QUERIES
;; ========================================

;; Get escrow info from registry
(define-read-only (get-escrow-info (escrow-id uint))
  (map-get? escrow-registry { escrow-id: escrow-id })
)

;; Get escrow IDs for a creator on a specific page (0-indexed)
(define-read-only (get-creator-escrows-page (creator principal) (page uint))
  (default-to 
    { escrow-ids: (list) }
    (map-get? creator-escrow-pages { creator: creator, page: page })
  )
)

;; Backwards-compatible: returns the first page of escrow IDs
(define-read-only (get-creator-escrows (creator principal))
  (get-creator-escrows-page creator u0)
)

;; Get per-creator metadata (total count + current page index)
(define-read-only (get-creator-info (creator principal))
  (default-to
    { total-count: u0, current-page: u0 }
    (map-get? creator-info { creator: creator })
  )
)

;; Get escrow IDs for a buyer on a specific page (0-indexed)
(define-read-only (get-buyer-escrows-page (the-buyer principal) (page uint))
  (default-to
    { escrow-ids: (list) }
    (map-get? buyer-escrow-pages { buyer: the-buyer, page: page })
  )
)

;; Backwards-compatible: returns the first page of buyer escrow IDs
(define-read-only (get-buyer-escrows (the-buyer principal))
  (get-buyer-escrows-page the-buyer u0)
)

;; Get per-buyer metadata (total count + current page index)
(define-read-only (get-buyer-info (the-buyer principal))
  (default-to
    { total-count: u0, current-page: u0 }
    (map-get? buyer-info { buyer: the-buyer })
  )
)

;; Get escrow IDs for a seller on a specific page (0-indexed)
(define-read-only (get-seller-escrows-page (the-seller principal) (page uint))
  (default-to
    { escrow-ids: (list) }
    (map-get? seller-escrow-pages { seller: the-seller, page: page })
  )
)

;; Backwards-compatible: returns the first page of seller escrow IDs
(define-read-only (get-seller-escrows (the-seller principal))
  (get-seller-escrows-page the-seller u0)
)

;; Get per-seller metadata (total count + current page index)
(define-read-only (get-seller-info (the-seller principal))
  (default-to
    { total-count: u0, current-page: u0 }
    (map-get? seller-info { seller: the-seller })
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
    (info (get-creator-info creator))
  )
    (ok {
      total-created: (get total-count info),
      current-page: (get current-page info)
    })
  )
)

;; Check if contract is paused
(define-read-only (get-paused)
  (ok (var-get is-paused))
)

;; ========================================
;; ADMIN FUNCTIONS - EMERGENCY PAUSE
;; ========================================

;; Pause the contract - owner only
(define-public (pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set is-paused true)
    (print { event: "factory-paused", paused-by: tx-sender })
    (ok true)
  )
)

;; Unpause the contract - owner only
(define-public (unpause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set is-paused false)
    (print { event: "factory-unpaused", unpaused-by: tx-sender })
    (ok true)
  )
)
