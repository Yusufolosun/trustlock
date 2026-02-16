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

;; ========================================
;; PUBLIC FUNCTIONS - INITIALIZATION
;; ========================================

;; Initialize a new escrow
;; @param buyer: Principal address of the buyer
;; @param seller: Principal address of the seller
;; @param amount: Amount of STX to escrow (in micro-STX)
;; @param deadline: Block height after which refund is allowed
;; @returns escrow-id on success, error code on failure
(define-public (initialize-escrow 
  (buyer principal)
  (seller principal)
  (amount uint)
  (deadline-blocks uint))
  (let (
    (escrow-id (get-next-escrow-id))
    (deadline (+ block-height deadline-blocks))
  )
    ;; Validate inputs
    (asserts! (> amount u0) (err u300)) ;; ERR-INVALID-AMOUNT
    (asserts! (> deadline-blocks u0) (err u301)) ;; ERR-DEADLINE-PASSED
    (asserts! (not (is-eq buyer seller)) (err u103)) ;; ERR-UNAUTHORIZED (same address)
    
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
    (escrow-data (unwrap! (get-escrow escrow-id) (err u201))) ;; ERR-NOT-FUNDED (escrow doesn't exist)
    (buyer (get buyer escrow-data))
    (amount (get amount escrow-data))
    (deadline (get deadline escrow-data))
    (status (get status escrow-data))
  )
    ;; CHECKS: Verify preconditions
    (asserts! (is-eq tx-sender buyer) (err u100)) ;; ERR-NOT-BUYER
    (asserts! (is-eq status STATUS-CREATED) (err u200)) ;; ERR-ALREADY-FUNDED
    (asserts! (< block-height deadline) (err u301)) ;; ERR-DEADLINE-PASSED
    
    ;; EFFECTS: Update state before external call
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow-data {
        status: STATUS-FUNDED,
        funded-at: (some block-height)
      })
    )
    
    ;; INTERACTIONS: Transfer funds to contract
    (match (stx-transfer? amount tx-sender (as-contract tx-sender))
      success (ok true)
      error (err u400) ;; ERR-TRANSFER-FAILED
    )
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
    (escrow-data (unwrap! (get-escrow escrow-id) (err u201))) ;; ERR-NOT-FUNDED
    (seller (get seller escrow-data))
    (amount (get amount escrow-data))
    (status (get status escrow-data))
  )
    ;; CHECKS: Verify preconditions
    (asserts! (is-eq tx-sender seller) (err u101)) ;; ERR-NOT-SELLER
    (asserts! (is-eq status STATUS-FUNDED) (err u201)) ;; ERR-NOT-FUNDED
    
    ;; EFFECTS: Update state before external call
    (map-set escrows
      { escrow-id: escrow-id }
      (merge escrow-data { status: STATUS-RELEASED })
    )
    
    ;; INTERACTIONS: Transfer funds from contract to seller
    (match (as-contract (stx-transfer? amount tx-sender seller))
      success (ok true)
      error (err u400) ;; ERR-TRANSFER-FAILED
    )
  )
)
