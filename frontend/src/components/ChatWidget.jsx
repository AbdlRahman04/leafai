function ChatWidget() {
    return (
        <button
            style={{
                position: "fixed",
                bottom: "30px",
                right: "30px",
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                backgroundColor: "#2e7d32",
                color: "white",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                zIndex: 1000,
            }}
        >
            💬
        </button>
    );
}

export default ChatWidget;