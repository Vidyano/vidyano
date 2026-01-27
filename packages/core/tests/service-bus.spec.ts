import { test, expect } from "@playwright/test";
import { ServiceBus } from "@vidyano/core";

test.describe("ServiceBus", () => {
    test.describe("String Messages", () => {
        test("send and subscribe to simple string message", () => {
            let received = false;
            let receivedMessage = "";
            let receivedDetail: any = null;

            const disposer = ServiceBus.subscribe("test-message", (_sender, message, detail) => {
                received = true;
                receivedMessage = message as string;
                receivedDetail = detail;
            });

            try {
                ServiceBus.send("test-message", { data: "hello" });

                expect(received).toBe(true);
                expect(receivedMessage).toBe("test-message");
                expect(receivedDetail).toEqual({ data: "hello" });
            } finally {
                disposer();
            }
        });

        test("send and subscribe to topic:message", () => {
            let received = false;
            let receivedMessage = "";

            const disposer = ServiceBus.subscribe("auth:login", (_sender, message) => {
                received = true;
                receivedMessage = message as string;
            });

            try {
                ServiceBus.send("auth:login", { user: "test" });

                expect(received).toBe(true);
                expect(receivedMessage).toBe("login");
            } finally {
                disposer();
            }
        });

        test("wildcard subscription receives all messages in topic", () => {
            const messages: string[] = [];

            const disposer = ServiceBus.subscribe("topic:*", (_sender, message) => {
                messages.push(message as string);
            });

            try {
                ServiceBus.send("topic:message1");
                ServiceBus.send("topic:message2");
                ServiceBus.send("topic:message3");

                expect(messages).toEqual(["message1", "message2", "message3"]);
            } finally {
                disposer();
            }
        });

        test("subscriber receives last message when receiveLast is true", () => {
            ServiceBus.send("last-message", { value: 42 });

            let receivedDetail: any = null;

            const disposer = ServiceBus.subscribe("last-message", (_sender, _message, detail) => {
                receivedDetail = detail;
            }, true);

            try {
                expect(receivedDetail).toEqual({ value: 42 });
            } finally {
                disposer();
            }
        });
    });

    test.describe("Symbol Messages", () => {
        test("send and subscribe to symbol message", () => {
            const MY_MESSAGE = Symbol("test-symbol");
            let received = false;
            let receivedMessage: string | symbol = "";
            let receivedDetail: any = null;

            const disposer = ServiceBus.subscribe(MY_MESSAGE, (_sender, message, detail) => {
                received = true;
                receivedMessage = message;
                receivedDetail = detail;
            });

            try {
                ServiceBus.send(MY_MESSAGE, { data: "symbol-test" });

                expect(received).toBe(true);
                expect(receivedMessage).toBe("test-symbol");
                expect(receivedDetail).toEqual({ data: "symbol-test" });
            } finally {
                disposer();
            }
        });

        test("symbol uniqueness is maintained", () => {
            const MSG1 = Symbol("same-description");
            const MSG2 = Symbol("same-description");

            let msg1Count = 0;
            let msg2Count = 0;

            const disposer1 = ServiceBus.subscribe(MSG1, () => {
                msg1Count++;
            });

            const disposer2 = ServiceBus.subscribe(MSG2, () => {
                msg2Count++;
            });

            try {
                ServiceBus.send(MSG1);
                ServiceBus.send(MSG2);

                expect(msg1Count).toBe(1);
                expect(msg2Count).toBe(1);
            } finally {
                disposer1();
                disposer2();
            }
        });

        test("symbol with topic:message description is parsed", () => {
            const AUTH_LOGIN = Symbol("auth:login");
            let receivedMessage: string | symbol = "";

            const disposer = ServiceBus.subscribe(AUTH_LOGIN, (_sender, message) => {
                receivedMessage = message;
            });

            try {
                ServiceBus.send(AUTH_LOGIN, { user: "test" });

                expect(receivedMessage).toBe("login");
            } finally {
                disposer();
            }
        });

        test("global symbol (Symbol.for) works correctly", () => {
            const GLOBAL_MSG = Symbol.for("global:test");
            let received = false;
            let receivedMessage: string | symbol = "";

            const disposer = ServiceBus.subscribe(GLOBAL_MSG, (_sender, message) => {
                received = true;
                receivedMessage = message;
            });

            try {
                ServiceBus.send(GLOBAL_MSG, { data: "global" });

                expect(received).toBe(true);
                expect(receivedMessage).toBe("test");
            } finally {
                disposer();
            }
        });

        test("symbol without description works", () => {
            const NO_DESC = Symbol();
            let received = false;

            const disposer = ServiceBus.subscribe(NO_DESC, () => {
                received = true;
            });

            try {
                ServiceBus.send(NO_DESC);

                expect(received).toBe(true);
            } finally {
                disposer();
            }
        });

        test("string subscribers don't receive symbol messages", () => {
            const MY_SYMBOL = Symbol("isolated");
            let stringReceived = false;
            let symbolReceived = false;

            const disposer1 = ServiceBus.subscribe("isolated", () => {
                stringReceived = true;
            });

            const disposer2 = ServiceBus.subscribe(MY_SYMBOL, () => {
                symbolReceived = true;
            });

            try {
                ServiceBus.send(MY_SYMBOL);

                expect(symbolReceived).toBe(true);
                expect(stringReceived).toBe(false);
            } finally {
                disposer1();
                disposer2();
            }
        });

        test("symbol subscribers don't receive string messages", () => {
            const MY_SYMBOL = Symbol("isolated");
            let stringReceived = false;
            let symbolReceived = false;

            const disposer1 = ServiceBus.subscribe("isolated", () => {
                stringReceived = true;
            });

            const disposer2 = ServiceBus.subscribe(MY_SYMBOL, () => {
                symbolReceived = true;
            });

            try {
                ServiceBus.send("isolated");

                expect(stringReceived).toBe(true);
                expect(symbolReceived).toBe(false);
            } finally {
                disposer1();
                disposer2();
            }
        });

        test("subscriber receives last symbol message when receiveLast is true", () => {
            const LAST_SYMBOL = Symbol("last-symbol");
            ServiceBus.send(LAST_SYMBOL, { value: 99 });

            let receivedDetail: any = null;

            const disposer = ServiceBus.subscribe(LAST_SYMBOL, (_sender, _message, detail) => {
                receivedDetail = detail;
            }, true);

            try {
                expect(receivedDetail).toEqual({ value: 99 });
            } finally {
                disposer();
            }
        });
    });

    test.describe("Sender Support", () => {
        test("send with sender for string message", () => {
            const mySender = { id: "test-sender" };
            let receivedSender: any = null;

            const disposer = ServiceBus.subscribe("sender-test", (sender) => {
                receivedSender = sender;
            });

            try {
                ServiceBus.send(mySender, "sender-test");
                expect(receivedSender).toBe(mySender);
            } finally {
                disposer();
            }
        });

        test("send with sender for symbol message", () => {
            const MY_SYMBOL = Symbol("sender-symbol");
            const mySender = { id: "test-sender" };
            let receivedSender: any = null;

            const disposer = ServiceBus.subscribe(MY_SYMBOL, (sender) => {
                receivedSender = sender;
            });

            try {
                ServiceBus.send(mySender, MY_SYMBOL);
                expect(receivedSender).toBe(mySender);
            } finally {
                disposer();
            }
        });
    });
});
