package models

// ProposeTradePayload mirrors the inbound JSON structure when a player hits "Propose Trade"
type ProposeTradePayload struct {
	DealID            string `json:"dealId"`
	CounterpartyID    string `json:"counterpartyId"`
	OfferedProperty   []int  `json:"offeredPropertyIds"`
	RequestedProperty []int  `json:"requestedPropertyIds"`
	CashOffered       int64  `json:"cashOffered"`
	CashRequested     int64  `json:"cashRequested"`
}

// TradeActionPayload captures simple binary actions like acceptance, rejection, or cancellation
type TradeActionPayload struct {
	DealID string `json:"dealId"`
	Action string `json:"action"` // "accept", "counter", "reject"
}

// InterceptPayload captures a third-party player trying to outbid a public trade broadcast
type InterceptPayload struct {
	DealID     string `json:"dealId"`
	CashOffset int64  `json:"cashOffset"`
}