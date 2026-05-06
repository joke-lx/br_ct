package handler

import "brochat_native_host/internal/protocol"

type Handler func(req protocol.Request) protocol.Response

type Registry struct {
	handlers map[string]Handler
}

func NewRegistry() *Registry {
	return &Registry{
		handlers: make(map[string]Handler),
	}
}

func (r *Registry) Register(command string, h Handler) {
	r.handlers[command] = h
}

func (r *Registry) Handle(command string, req protocol.Request) protocol.Response {
	h, ok := r.handlers[command]
	if !ok {
		return protocol.Response{Status: "error", Message: "Unknown command: " + command}
	}
	return h(req)
}
