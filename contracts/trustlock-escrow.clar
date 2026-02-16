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
