;; TrustLock Escrow
;; Core escrow logic for two-party transactions

;; Implement the canonical escrow trait
(impl-trait .trustlock-traits.escrow-trait)

;; ========================================
;; CONSTANTS
;; ========================================

;; Status strings
(define-constant STATUS-CREATED "CREATED")
(define-constant STATUS-FUNDED "FUNDED")
(define-constant STATUS-RELEASED "RELEASED")
(define-constant STATUS-REFUNDED "REFUNDED")
(define-constant STATUS-CANCELLED "CANCELLED")

;; Contract owner (deployer) - can pause/unpause
(define-constant CONTRACT-OWNER tx-sender)

;; Error codes (mirrored from trustlock-traits for local use)
;; Authorization errors (u100-u199)
(define-constant ERR-NOT-BUYER (err u100))
(define-constant ERR-NOT-SELLER (err u101))
(define-constant ERR-UNAUTHORIZED (err u103))
(define-constant ERR-NOT-FACTORY (err u104))
(define-constant ERR-NOT-OWNER (err u105))
;; State errors (u200-u299)
(define-constant ERR-ALREADY-FUNDED (err u200))
(define-constant ERR-NOT-FUNDED (err u201))
(define-constant ERR-ESCROW-NOT-FOUND (err u205))
(define-constant ERR-INVALID-STATE (err u204))
(define-constant ERR-CONTRACT-PAUSED (err u206))
;; Validation errors (u300-u399)
(define-constant ERR-INVALID-AMOUNT (err u300))
(define-constant ERR-DEADLINE-PASSED (err u301))
(define-constant ERR-DEADLINE-NOT-REACHED (err u302))
(define-constant ERR-AMOUNT-TOO-LOW (err u304))
(define-constant ERR-DEADLINE-TOO-LONG (err u305))
;; Execution errors (u400-u499)
(define-constant ERR-TRANSFER-FAILED (err u400))

;; Bounds
(define-constant MIN-ESCROW-AMOUNT u1000)       ;; 0.001 STX minimum
(define-constant MAX-DEADLINE-BLOCKS u52560)    ;; ~1 year at 10-min blocks


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

;; Total number of escrows initialized in this contract
(define-data-var escrow-count uint u0)

;; Emergency pause flag
(define-data-var is-paused bool false)

;; Get escrow data by ID
(define-read-only (get-escrow (escrow-id uint))
  (map-get? escrows { escrow-id: escrow-id })
)

;; ========================================
;; PUBLIC FUNCTIONS - INITIALIZATION
;; ========================================

;; Initialize a new escrow
;; The escrow-id is assigned by the factory (single source of truth).
;; @param escrow-id: ID assigned by the factory contract
;; @param buyer: Principal address of the buyer
;; @param seller: Principal address of the seller
;; @param amount: Amount of STX to escrow (in micro-STX)
;; @param deadline-blocks: Number of blocks until refund is allowed
;; @returns escrow-id on success, error code on failure
(define-public (initialize-escrow
  (escrow-id uint)
  (buyer principal)
  (seller principal)
  (amount uint)
  (deadline-blocks uint))
  (let (
    (deadline (+ block-height deadline-blocks))
  )
    ;; Pause check
    (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED)

    ;; Only allow calls through another contract (e.g. the factory).
    ;; Direct calls have tx-sender == contract-caller; inter-contract
    ;; calls set contract-caller to the calling contract.
    (asserts! (not (is-eq tx-sender contract-caller)) ERR-NOT-FACTORY)

    ;; Prevent overwriting an existing escrow
    (asserts! (is-none (get-escrow escrow-id)) ERR-ALREADY-FUNDED)

    ;; Validate inputs
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (asserts! (>= amount MIN-ESCROW-AMOUNT) ERR-AMOUNT-TOO-LOW)
    (asserts! (> deadline-blocks u0) ERR-DEADLINE-PASSED)
    (asserts! (<= deadline-blocks MAX-DEADLINE-BLOCKS) ERR-DEADLINE-TOO-LONG)
    (asserts! (not (is-eq buyer seller)) ERR-UNAUTHORIZED)
    
    ;; Create escrow entry
    (map-set escrows
      { escrow-id: escrow-id }
      {
        buyer: buyer,
        seller: seller,
        amount: amount,
        deadline: deadline,
        status: STATUS-CREATED,
        funded-at: none
      }
    )

    ;; Track total escrows initialized
    (var-set escrow-count (+ (var-get escrow-count) u1))

    ;; Emit event for off-chain indexers
    (print {
      event: "escrow-created",
      escrow-id: escrow-id,
      buyer: buyer,
      seller: seller,
      amount: amount,
      deadline: deadline
    })
    
    (ok escrow-id)
  )
)

;; ========================================
;; PUBLIC FUNCTIONS - DEPOSIT
;; ========================================

;; Deposit funds into escrow
;; Can only be called by buyer before deadline
;; @param escrow-id: ID of the escrow to fund
;; @returns (ok true) on success, error code on failure
(define-public (deposit (escrow-id uint))
  (let (
    ;; Retrieve escrow data
    (escrow-data (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
    (buyer (get buyer escrow-data))
    (amount (get amount escrow-data))
    (deadline (get deadline escrow-data))
    (status (get status escrow-data))
  )
    ;; CHECKS: Verify preconditions
    (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED)
    (asserts! (is-eq tx-sender buyer) ERR-NOT-BUYER)
    (asserts! (is-eq status STATUS-CREATED) ERR-ALREADY-FUNDED)
    (asserts! (< block-height deadline) ERR-DEADLINE-PASSED)
    
    ;; EFFECTS: Update state before external call
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow-data {
        status: STATUS-FUNDED,
        funded-at: (some block-height)
      })
    )
    
    ;; Emit event for off-chain indexers
    (print {
      event: "escrow-funded",
      escrow-id: escrow-id,
      buyer: buyer,
      amount: amount,
      funded-at: block-height
    })

    ;; INTERACTIONS: Transfer funds to contract
    (match (stx-transfer? amount tx-sender (as-contract tx-sender))
      success (ok true)
      error ERR-TRANSFER-FAILED
    )
  )
)

;; ========================================
;; PUBLIC FUNCTIONS - CANCELLATION
;; ========================================

;; Cancel an escrow before it has been funded
;; Can only be called by the buyer while status is CREATED
;; @param escrow-id: ID of the escrow to cancel
;; @returns (ok true) on success, error code on failure
(define-public (cancel-escrow (escrow-id uint))
  (let (
    (escrow-data (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
    (buyer (get buyer escrow-data))
    (status (get status escrow-data))
    (is-inter-contract (not (is-eq tx-sender contract-caller)))
  )
    ;; CHECKS
    (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED)
    ;; Allow if buyer calls directly, or if called via another contract
    ;; (the factory enforces its own creator check before delegating here)
    (asserts! (or (is-eq tx-sender buyer) is-inter-contract) ERR-NOT-BUYER)
    (asserts! (is-eq status STATUS-CREATED) ERR-INVALID-STATE)

    ;; EFFECTS
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow-data { status: STATUS-CANCELLED })
    )

    ;; Emit event for off-chain indexers
    (print {
      event: "escrow-cancelled",
      escrow-id: escrow-id,
      cancelled-by: tx-sender
    })

    (ok true)
  )
)

;; ========================================
;; PUBLIC FUNCTIONS - RELEASE
;; ========================================

;; Release funds to seller
;; Can only be called by seller after funding
;; @param escrow-id: ID of the escrow to release
;; @returns (ok true) on success, error code on failure
(define-public (release (escrow-id uint))
  (let (
    ;; Retrieve escrow data
    (escrow-data (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
    (seller (get seller escrow-data))
    (amount (get amount escrow-data))
    (status (get status escrow-data))
  )
    ;; CHECKS: Verify preconditions
    (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED)
    (asserts! (is-eq tx-sender seller) ERR-NOT-SELLER)
    (asserts! (is-eq status STATUS-FUNDED) ERR-NOT-FUNDED)
    
    ;; EFFECTS: Update state before external call
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow-data { status: STATUS-RELEASED })
    )
    
    ;; Emit event for off-chain indexers
    (print {
      event: "escrow-released",
      escrow-id: escrow-id,
      seller: seller,
      amount: amount
    })

    ;; INTERACTIONS: Transfer funds from contract to seller
    (match (as-contract (stx-transfer? amount tx-sender seller))
      success (ok true)
      error ERR-TRANSFER-FAILED
    )
  )
)

;; ========================================
;; PUBLIC FUNCTIONS - REFUND
;; ========================================

;; Refund funds to buyer after deadline
;; Can be called by anyone after deadline passes
;; @param escrow-id: ID of the escrow to refund
;; @returns (ok true) on success, error code on failure
(define-public (refund (escrow-id uint))
  (let (
    ;; Retrieve escrow data
    (escrow-data (unwrap! (get-escrow escrow-id) ERR-ESCROW-NOT-FOUND))
    (buyer (get buyer escrow-data))
    (amount (get amount escrow-data))
    (deadline (get deadline escrow-data))
    (status (get status escrow-data))
  )
    ;; CHECKS: Verify preconditions
    (asserts! (not (var-get is-paused)) ERR-CONTRACT-PAUSED)
    (asserts! (is-eq status STATUS-FUNDED) ERR-NOT-FUNDED)
    (asserts! (>= block-height deadline) ERR-DEADLINE-NOT-REACHED)
    
    ;; EFFECTS: Update state before external call
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow-data { status: STATUS-REFUNDED })
    )
    
    ;; Emit event for off-chain indexers
    (print {
      event: "escrow-refunded",
      escrow-id: escrow-id,
      buyer: buyer,
      amount: amount
    })

    ;; INTERACTIONS: Transfer funds from contract to buyer
    (match (as-contract (stx-transfer? amount tx-sender buyer))
      success (ok true)
      error ERR-TRANSFER-FAILED
    )
  )
)

;; ========================================
;; READ-ONLY FUNCTIONS
;; ========================================

;; Get complete escrow information
;; @param escrow-id: ID of the escrow
;; @returns Escrow details or error
(define-read-only (get-info (escrow-id uint))
  (match (get-escrow escrow-id)
    escrow-data (ok escrow-data)
    ERR-ESCROW-NOT-FOUND
  )
)

;; Get current escrow status
;; @param escrow-id: ID of the escrow
;; @returns Status string or error
(define-read-only (get-status (escrow-id uint))
  (match (get-escrow escrow-id)
    escrow-data (ok (get status escrow-data))
    ERR-ESCROW-NOT-FOUND
  )
)

;; Check if escrow can be refunded
;; @param escrow-id: ID of the escrow
;; @returns true if refundable, false otherwise
(define-read-only (is-refundable (escrow-id uint))
  (match (get-escrow escrow-id)
    escrow-data 
      (and 
        (is-eq (get status escrow-data) STATUS-FUNDED)
        (>= block-height (get deadline escrow-data))
      )
    false
  )
)

;; Get total number of escrows initialized
;; Note: The factory contract is the canonical source for escrow IDs.
;; This counter tracks how many escrows exist in this contract.
(define-read-only (get-escrow-count)
  (ok (var-get escrow-count))
)

;; Check if contract is paused
(define-read-only (get-paused)
  (ok (var-get is-paused))
)

;; ========================================
;; ADMIN FUNCTIONS - EMERGENCY PAUSE
;; ========================================

;; Pause the contract - owner only
;; Blocks all state-changing operations until unpaused
(define-public (pause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set is-paused true)
    (print { event: "contract-paused", paused-by: tx-sender })
    (ok true)
  )
)

;; Unpause the contract - owner only
(define-public (unpause)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set is-paused false)
    (print { event: "contract-unpaused", unpaused-by: tx-sender })
    (ok true)
  )
)
