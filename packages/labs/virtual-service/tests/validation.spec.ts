import { test, expect } from "@playwright/test";
import { VirtualService, VirtualPersistentObjectActions } from "../src/index.js";
import type { VirtualPersistentObject, RuleValidationContext } from "../src/index.js";

test("validates required attributes on save", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "Required",
                value: null
            },
            {
                name: "LastName",
                type: "String",
                rules: "Required",
                value: "Doe"
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with null required field
    await person.save({ throwExceptions: false });

    // Check validation error on FirstName (null value should fail)
    const firstName = person.getAttribute("FirstName");
    expect(firstName).toBeDefined();
    expect(firstName!.validationError).toBe("This field is required");

    // Check that LastName has no validation error
    const lastName = person.getAttribute("LastName");
    expect(lastName).toBeDefined();
    expect(lastName!.validationError).toBeFalsy();
});

test("validates IsEmail rule", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "IsEmail",
                value: "invalid-email"
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with invalid email
    await person.save({ throwExceptions: false });

    // Check validation error
    const email = person.getAttribute("Email");
    expect(email).toBeDefined();
    expect(email!.validationError).toBe("Email format is invalid");
});

test("validates MaxLength rule", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "MaxLength(5)",
                value: "Alexander"
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with value exceeding max length
    await person.save({ throwExceptions: false });

    // Check validation error
    const firstName = person.getAttribute("FirstName");
    expect(firstName).toBeDefined();
    expect(firstName!.validationError).toBe("Maximum length is 5 characters");
});

test("validates NotEmpty rule", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "NotEmpty",
                value: ""
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with empty value
    await person.save({ throwExceptions: false });

    // Check validation error
    const firstName = person.getAttribute("FirstName");
    expect(firstName).toBeDefined();
    expect(firstName!.validationError).toBe("This field cannot be empty");
});

test("validates multiple rules on single attribute", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "NotEmpty; MaxLength(50); IsEmail",
                value: "invalid-email"
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with invalid email (should fail on IsEmail rule)
    await person.save({ throwExceptions: false });

    // Check validation error - should be the first failing rule
    const email = person.getAttribute("Email");
    expect(email).toBeDefined();
    expect(email!.validationError).toBe("Email format is invalid");
});

test("validates MinLength rule", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Password",
                type: "String",
                rules: "MinLength(8)",
                value: "short"
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with value below min length
    await person.save({ throwExceptions: false });

    // Check validation error
    const password = person.getAttribute("Password");
    expect(password).toBeDefined();
    expect(password!.validationError).toBe("Minimum length is 8 characters");
});

test("validates MinValue rule", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Product",
        label: "Product",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Price",
                type: "Number",
                rules: "MinValue(0)",
                value: -10
            }
        ]    });

    await service.initialize();

    const product = await service.getPersistentObject(null, "Product", "1");

    // Attempt to save with value below minimum
    await product.save({ throwExceptions: false });

    // Check validation error
    const price = product.getAttribute("Price");
    expect(price).toBeDefined();
    expect(price!.validationError).toBe("Minimum value is 0");
});

test("validates MaxValue rule", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Product",
        label: "Product",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Discount",
                type: "Number",
                rules: "MaxValue(100)",
                value: 150
            }
        ]    });

    await service.initialize();

    const product = await service.getPersistentObject(null, "Product", "1");

    // Attempt to save with value above maximum
    await product.save({ throwExceptions: false });

    // Check validation error
    const discount = product.getAttribute("Discount");
    expect(discount).toBeDefined();
    expect(discount!.validationError).toBe("Maximum value is 100");
});

test("validates IsUrl rule", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Website",
        label: "Website",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Url",
                type: "String",
                rules: "IsUrl",
                value: "not-a-url"
            }
        ]    });

    await service.initialize();

    const website = await service.getPersistentObject(null, "Website", "1");

    // Attempt to save with invalid URL
    await website.save({ throwExceptions: false });

    // Check validation error
    const url = website.getAttribute("Url");
    expect(url).toBeDefined();
    expect(url!.validationError).toBe("Value must be a valid URL");
});

test("supports custom business rules", async () => {
    const service = new VirtualService();

    // Register custom rule
    service.registerBusinessRule("IsPhoneNumber", (value: any, _context: RuleValidationContext) => {
        if (!value)
            return;

        const phoneRegex = /^\+?[\d\s-()]+$/;
        if (!phoneRegex.test(String(value)))
            throw new Error("Invalid phone number format");
    });

    service.registerPersistentObject({
        type: "Contact",
        label: "Contact",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Phone",
                type: "String",
                rules: "IsPhoneNumber",
                value: "abc123"
            }
        ]    });

    await service.initialize();

    const contact = await service.getPersistentObject(null, "Contact", "1");

    // Attempt to save with invalid phone number
    await contact.save({ throwExceptions: false });

    // Check validation error
    const phone = contact.getAttribute("Phone");
    expect(phone).toBeDefined();
    expect(phone!.validationError).toBe("Invalid phone number format");
});

test("allows save when validation passes", async () => {
    const service = new VirtualService();

    let saveCalled = false;

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "NotEmpty; IsEmail",
                value: "test@example.com"
            }
        ]
    }, class extends VirtualPersistentObjectActions {
        async onSave(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveCalled = true;
            return super.onSave(obj);
        }
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with valid data
    await person.save();

    // Check that validation passed and save was called
    const email = person.getAttribute("Email");
    expect(email).toBeDefined();
    expect(email!.validationError).toBeFalsy();
    expect(saveCalled).toBe(true);
});

test("prevents overriding built-in rules", () => {
    const service = new VirtualService();

    expect(() => {
        service.registerBusinessRule("IsEmail", (_value: any, _context: RuleValidationContext) => {
            throw new Error("Custom validation");
        });
    }).toThrow("Cannot override built-in rule: IsEmail");
});

// Unhappy path tests

test("handles unknown business rules", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "UnknownRule",
                value: "test@example.com"
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with unknown rule - should throw an exception
    try {
        await person.save();
        throw new Error("Expected save to throw");
    } catch (error) {
        expect(String(error)).toContain("Unknown business rule: UnknownRule");
    }

    // The error should also be in the notification
    expect(person.notification).toContain("Unknown business rule: UnknownRule");
    expect(person.notificationType).toBe("Error");
});

test("handles null and undefined values correctly", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        actions: ["Save"],
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "IsEmail",
                value: null
            },
            {
                name: "Age",
                type: "Number",
                rules: "MinValue(0)",
                value: undefined
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Null/undefined values should pass validation (not considered errors)
    await person.save();

    const email = person.getAttribute("Email");
    const age = person.getAttribute("Age");
    expect(email!.validationError).toBeFalsy();
    expect(age!.validationError).toBeFalsy();
});

test("validates boundary values for MinValue and MaxValue", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Product",
        label: "Product",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "MinBoundary",
                type: "Number",
                rules: "MinValue(0)",
                value: 0
            },
            {
                name: "MaxBoundary",
                type: "Number",
                rules: "MaxValue(100)",
                value: 100
            }
        ]    });

    await service.initialize();

    const product = await service.getPersistentObject(null, "Product", "1");

    // Boundary values should pass
    await product.save();

    const minBoundary = product.getAttribute("MinBoundary");
    const maxBoundary = product.getAttribute("MaxBoundary");
    expect(minBoundary!.validationError).toBeFalsy();
    expect(maxBoundary!.validationError).toBeFalsy();
});

test("validates empty string vs whitespace for NotEmpty", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "EmptyString",
                type: "String",
                rules: "NotEmpty",
                value: ""
            },
            {
                name: "WhitespaceOnly",
                type: "String",
                rules: "NotEmpty",
                value: "   "
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Both should fail validation
    await person.save({ throwExceptions: false });

    const emptyString = person.getAttribute("EmptyString");
    const whitespaceOnly = person.getAttribute("WhitespaceOnly");
    expect(emptyString!.validationError).toBe("This field cannot be empty");
    expect(whitespaceOnly!.validationError).toBe("This field cannot be empty");
});

test("validates non-numeric values for Min/MaxValue rules", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Product",
        label: "Product",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Price",
                type: "String",
                rules: "MinValue(0)",
                value: "not-a-number"
            }
        ]    });

    await service.initialize();

    const product = await service.getPersistentObject(null, "Product", "1");

    // Should fail with "must be a number" error
    await product.save({ throwExceptions: false });

    const price = product.getAttribute("Price");
    expect(price!.validationError).toBe("Value must be a number");
});

test("validates multiple failing rules returns first error", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "NotEmpty; MinLength(5); IsEmail",
                value: ""
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Should return the first failing rule's error (NotEmpty)
    await person.save({ throwExceptions: false });

    const email = person.getAttribute("Email");
    expect(email!.validationError).toBe("This field cannot be empty");
});

test("does not convert empty parameter to zero", async () => {
    const service = new VirtualService();

    // Track what parameters the custom rule receives
    let receivedParams: any[] = [];

    service.registerBusinessRule("CheckParams", (_value: any, _context: RuleValidationContext, ...params: any[]) => {
        receivedParams = params;
    });

    service.registerPersistentObject({
        type: "Test",
        label: "Test",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Value",
                type: "String",
                rules: "CheckParams(,5)",  // Empty first param, numeric second param
                value: "test"
            }
        ]
    });

    await service.initialize();

    const obj = await service.getPersistentObject(null, "Test", "1");
    await obj.save();

    // Empty parameter should remain empty string, not be converted to 0
    expect(receivedParams[0]).toBe("");
    expect(receivedParams[1]).toBe(5);
});

test("validates special characters and unicode in strings", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Name",
                type: "String",
                rules: "NotEmpty; MaxLength(10)",
                value: "测试🚀"
            },
            {
                name: "Email",
                type: "String",
                rules: "IsEmail",
                value: "test@例え.jp"
            }
        ]    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Unicode characters should be handled correctly
    await person.save({ throwExceptions: false });

    const name = person.getAttribute("Name");
    const email = person.getAttribute("Email");
    expect(name!.validationError).toBeFalsy(); // Unicode string within length limit
    expect(email!.validationError).toBe("Email format is invalid"); // Unicode in email domain
});

test("custom rule can access other attributes via context", async () => {
    const service = new VirtualService();

    // Register custom rule that validates password confirmation
    service.registerBusinessRule("MatchesPassword", (value: any, context: RuleValidationContext) => {
        if (!value)
            return;

        const passwordValue = context.persistentObject.getAttributeValue("Password");
        if (value !== passwordValue)
            throw new Error("Passwords do not match");
    });

    service.registerPersistentObject({
        type: "User",
        label: "User",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Password",
                type: "String",
                value: "secret123"
            },
            {
                name: "ConfirmPassword",
                type: "String",
                rules: "MatchesPassword",
                value: "different123"
            }
        ]
    });

    await service.initialize();

    const user = await service.getPersistentObject(null, "User", "1");

    // Attempt to save with mismatched passwords
    await user.save({ throwExceptions: false });

    // Check validation error
    const confirmPassword = user.getAttribute("ConfirmPassword");
    expect(confirmPassword).toBeDefined();
    expect(confirmPassword!.validationError).toBe("Passwords do not match");

    // Now fix the password match and try again
    user.getAttribute("ConfirmPassword")!.value = "secret123";
    await user.save();

    // Should pass validation now
    expect(confirmPassword!.validationError).toBeFalsy();
});

test("custom rule receives converted value not raw DTO value", async () => {
    const service = new VirtualService();

    // Track what type and value the custom rule receives
    let receivedValue: any = undefined;
    let receivedType: string = "";

    service.registerBusinessRule("CheckType", (value: any, _context: RuleValidationContext) => {
        receivedValue = value;
        receivedType = typeof value;
    });

    service.registerPersistentObject({
        type: "Test",
        label: "Test",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "IsActive",
                type: "Boolean",
                rules: "CheckType",
                value: "True" // DTO stores as string "True"
            }
        ]
    });

    await service.initialize();

    const obj = await service.getPersistentObject(null, "Test", "1");
    await obj.save();

    // The custom rule should receive boolean true, not string "True"
    expect(receivedType).toBe("boolean");
    expect(receivedValue).toBe(true);
});

test("automatically sets isRequired when NotEmpty rule is present", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "NotEmpty; MaxLength(50)",
                value: ""
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with empty value
    await person.save({ throwExceptions: false });

    // Check validation error - NotEmpty rule executes and fails
    const firstName = person.getAttribute("FirstName");
    expect(firstName).toBeDefined();
    expect(firstName!.validationError).toBe("This field cannot be empty");
});

test("automatically sets isRequired when Required rule is present", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "LastName",
                type: "String",
                rules: "Required; MaxLength(50)",
                value: null
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with null value (should fail Required rule)
    await person.save({ throwExceptions: false });

    // Check validation error - Required rule should fail
    const lastName = person.getAttribute("LastName");
    expect(lastName).toBeDefined();
    expect(lastName!.validationError).toBe("This field is required");
});

test("does not set isRequired when NotEmpty or Required is not in rules", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "IsEmail; MaxLength(100)",
                value: ""
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with empty value (should pass because not required)
    await person.save();

    // Check that no validation error occurs
    const email = person.getAttribute("Email");
    expect(email).toBeDefined();
    expect(email!.validationError).toBeFalsy();
});

test("Required rule allows empty string but not null", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "Required",
                value: ""
            },
            {
                name: "LastName",
                type: "String",
                rules: "Required",
                value: null
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save - empty string should pass, null should fail
    await person.save({ throwExceptions: false });

    // FirstName with empty string should pass
    const firstName = person.getAttribute("FirstName");
    expect(firstName).toBeDefined();
    expect(firstName!.validationError).toBeFalsy();

    // LastName with null should fail
    const lastName = person.getAttribute("LastName");
    expect(lastName).toBeDefined();
    expect(lastName!.validationError).toBe("This field is required");
});

test("NotEmpty rule rejects both null and empty string", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "NotEmpty",
                value: ""
            },
            {
                name: "LastName",
                type: "String",
                rules: "NotEmpty",
                value: null
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save - both should fail
    await person.save({ throwExceptions: false });

    // FirstName with empty string should fail
    const firstName = person.getAttribute("FirstName");
    expect(firstName).toBeDefined();
    expect(firstName!.validationError).toBe("This field cannot be empty");

    // LastName with null should fail
    const lastName = person.getAttribute("LastName");
    expect(lastName).toBeDefined();
    expect(lastName!.validationError).toBe("This field cannot be empty");
});

// Translation tests

test("uses default English messages when no translate function provided", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "Required; IsEmail",
                value: null
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save({ throwExceptions: false });

    const email = person.getAttribute("Email");
    expect(email!.validationError).toBe("This field is required");
});

test("translates simple validation rules", async () => {
    // Save original messages
    const originalMessages = VirtualService.messages;

    VirtualService.messages = {
        ...originalMessages,
        "Required": "Dit veld is verplicht",
        "NotEmpty": "Dit veld mag niet leeg zijn",
        "IsEmail": "E-mailformaat is ongeldig"
    };

    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "Required",
                value: null
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save({ throwExceptions: false });

    const email = person.getAttribute("Email");
    expect(email!.validationError).toBe("Dit veld is verplicht");

    // Restore original messages
    VirtualService.messages = originalMessages;
});

test("translates parameterized validation rules with positional params", async () => {
    // Save original messages
    const originalMessages = VirtualService.messages;

    VirtualService.messages = {
        ...originalMessages,
        "MaxLength": "Maximale lengte is {0} tekens",
        "MinLength": "Minimale lengte is {0} tekens",
        "MaxValue": "Maximale waarde is {0}",
        "MinValue": "Minimale waarde is {0}"
    };

    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Name",
                type: "String",
                rules: "MaxLength(50)",
                value: "A".repeat(51)
            },
            {
                name: "Age",
                type: "Number",
                rules: "MinValue(18)",
                value: 15
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save({ throwExceptions: false });

    const name = person.getAttribute("Name");
    const age = person.getAttribute("Age");
    expect(name!.validationError).toBe("Maximale lengte is 50 tekens");
    expect(age!.validationError).toBe("Minimale waarde is 18");

    // Restore original messages
    VirtualService.messages = originalMessages;
});

test("getMessage formats parameterized messages correctly", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Test",
        label: "Test",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Field1",
                type: "String",
                rules: "MaxLength(40)",
                value: "A".repeat(50)
            },
            {
                name: "Field2",
                type: "Number",
                rules: "MinValue(10)",
                value: 5
            }
        ]
    });

    await service.initialize();

    const obj = await service.getPersistentObject(null, "Test", "1");
    await obj.save({ throwExceptions: false });

    const field1 = obj.getAttribute("Field1");
    const field2 = obj.getAttribute("Field2");
    expect(field1!.validationError).toBe("Maximum length is 40 characters");
    expect(field2!.validationError).toBe("Minimum value is 10");
});

test("translates multiple attributes with different rules in one save", async () => {
    // Save original messages
    const originalMessages = VirtualService.messages;

    VirtualService.messages = {
        ...originalMessages,
        "Required": "Requerido",
        "IsEmail": "Formato de correo inválido",
        "MinLength": "Longitud mínima es {0} caracteres"
    };

    const service = new VirtualService();

    service.registerPersistentObject({
        type: "User",
        label: "User",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Username",
                type: "String",
                rules: "Required",
                value: null
            },
            {
                name: "Email",
                type: "String",
                rules: "IsEmail",
                value: "invalid-email"
            },
            {
                name: "Password",
                type: "String",
                rules: "MinLength(8)",
                value: "short"
            }
        ]
    });

    await service.initialize();

    const user = await service.getPersistentObject(null, "User", "1");
    await user.save({ throwExceptions: false });

    const username = user.getAttribute("Username");
    const email = user.getAttribute("Email");
    const password = user.getAttribute("Password");
    expect(username!.validationError).toBe("Requerido");
    expect(email!.validationError).toBe("Formato de correo inválido");
    expect(password!.validationError).toBe("Longitud mínima es 8 caracteres");

    // Restore original messages
    VirtualService.messages = originalMessages;
});

test("custom rule can use context.service.getMessage()", async () => {
    // Save original messages
    const originalMessages = VirtualService.messages;

    VirtualService.messages = {
        ...originalMessages,
        "MatchesPassword": "Les mots de passe ne correspondent pas",
        "MinimumAge": "L'âge minimum est {0}"
    };

    const service = new VirtualService();

    service.registerBusinessRule("MatchesPassword", (value: any, context: RuleValidationContext) => {
        if (!value)
            return;

        const passwordValue = context.persistentObject.getAttributeValue("Password");
        if (value !== passwordValue)
            throw new Error(context.service.getMessage("MatchesPassword"));
    });

    service.registerBusinessRule("MinimumAge", (value: any, context: RuleValidationContext, minAge: number) => {
        if (!value)
            return;

        const age = Number(value);
        if (age < minAge)
            throw new Error(context.service.getMessage("MinimumAge", minAge));
    });

    service.registerPersistentObject({
        type: "User",
        label: "User",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Password",
                type: "String",
                value: "secret123"
            },
            {
                name: "ConfirmPassword",
                type: "String",
                rules: "MatchesPassword",
                value: "different123"
            },
            {
                name: "Age",
                type: "Number",
                rules: "MinimumAge(18)",
                value: 15
            }
        ]
    });

    await service.initialize();

    const user = await service.getPersistentObject(null, "User", "1");
    await user.save({ throwExceptions: false });

    const confirmPassword = user.getAttribute("ConfirmPassword");
    const age = user.getAttribute("Age");
    expect(confirmPassword!.validationError).toBe("Les mots de passe ne correspondent pas");
    expect(age!.validationError).toBe("L'âge minimum est 18");

    // Restore original messages
    VirtualService.messages = originalMessages;
});

test("custom rule can throw errors directly without using getMessage", async () => {
    const service = new VirtualService();

    service.registerBusinessRule("IsPhoneNumber", (value: any, _context: RuleValidationContext) => {
        if (!value)
            return;

        const phoneRegex = /^\+?[\d\s-()]+$/;
        if (!phoneRegex.test(String(value)))
            throw new Error("Invalid phone number format");
    });

    service.registerPersistentObject({
        type: "Contact",
        label: "Contact",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Phone",
                type: "String",
                rules: "IsPhoneNumber",
                value: "abc123"
            }
        ]
    });

    await service.initialize();

    const contact = await service.getPersistentObject(null, "Contact", "1");
    await contact.save({ throwExceptions: false });

    const phone = contact.getAttribute("Phone");
    expect(phone!.validationError).toBe("Invalid phone number format");
});

// checkRules tests

test("checkRules sets notification on validation failure", async () => {
    const service = new VirtualService();

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "Required",
                value: null
            }
        ]
    });

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save({ throwExceptions: false });

    // Check that notification is set
    expect(person.notification).toBe("Some required information is missing or incorrect.");
    expect(person.notificationType).toBe("Error");
});

test("validation failure prevents saveNew/saveExisting from being called", async () => {
    const service = new VirtualService();

    let saveNewCalled = false;
    let saveExistingCalled = false;

    class TestActions extends VirtualPersistentObjectActions {
        protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveNewCalled = true;
            return obj;
        }

        protected async saveExisting(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveExistingCalled = true;
            return obj;
        }
    }

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "Required",
                value: null
            }
        ]
    }, TestActions);

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");

    // Attempt to save with invalid data
    const result = await person.save({ throwExceptions: false });

    // Verify save methods were NOT called
    expect(saveNewCalled).toBe(false);
    expect(saveExistingCalled).toBe(false);

    // Verify save returned false
    expect(result).toBe(false);
});

test("checkRules override - custom validation", async () => {
    const service = new VirtualService();

    class TestActions extends VirtualPersistentObjectActions {
        checkRules(obj: VirtualPersistentObject): boolean {
            // Custom validation: reject Name="invalid"
            const name = obj.getAttributeValue("Name");
            if (name === "invalid") {
                obj.setValidationError("Name", "Name cannot be 'invalid'");
                obj.setNotification("Custom validation failed", "Error");
                return false;
            }
            return true;
        }

        protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            return obj;
        }
    }

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Name",
                type: "String",
                value: "invalid"
            }
        ]
    }, TestActions);

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save({ throwExceptions: false });

    // Check custom validation error
    const name = person.getAttribute("Name");
    expect(name!.validationError).toBe("Name cannot be 'invalid'");
    expect(person.notification).toBe("Custom validation failed");
});

test("checkRules override - skip default validation", async () => {
    const service = new VirtualService();

    let saveCalled = false;

    class TestActions extends VirtualPersistentObjectActions {
        checkRules(_obj: VirtualPersistentObject): boolean {
            // Skip all validation
            return true;
        }

        protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveCalled = true;
            return obj;
        }

        protected async saveExisting(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            saveCalled = true;
            return obj;
        }
    }

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "Required",
                value: null  // Would normally fail validation
            }
        ]
    }, TestActions);

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save();

    // Save should succeed because we skipped validation
    expect(saveCalled).toBe(true);

    // No validation error should be set
    const firstName = person.getAttribute("FirstName");
    expect(firstName!.validationError).toBeFalsy();
});

test("checkRules override - call super for combined validation", async () => {
    const service = new VirtualService();

    class TestActions extends VirtualPersistentObjectActions {
        checkRules(obj: VirtualPersistentObject): boolean {
            // Add custom validation first
            const name = obj.getAttributeValue("Name");
            if (name === "reserved") {
                obj.setValidationError("Name", "Name is reserved");
                obj.setNotification("Custom validation failed", "Error");
                return false;
            }

            // Then call super for default validation (Required rule, etc.)
            return super.checkRules(obj);
        }

        protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            return obj;
        }
    }

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Name",
                type: "String",
                rules: "Required",
                value: null
            }
        ]
    }, TestActions);

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save({ throwExceptions: false });

    // Default validation should catch Required rule failure
    const name = person.getAttribute("Name");
    expect(name!.validationError).toBe("This field is required");
});

test("checkRules receives wrapped object with helper methods", async () => {
    const service = new VirtualService();

    let receivedObj: VirtualPersistentObject | null = null;

    class TestActions extends VirtualPersistentObjectActions {
        checkRules(obj: VirtualPersistentObject): boolean {
            receivedObj = obj;
            return super.checkRules(obj);
        }

        protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            return obj;
        }
    }

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "FirstName",
                type: "String",
                rules: "MaxLength(50)",
                value: "John"
            }
        ]
    }, TestActions);

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save();

    // Verify the object has helper methods
    expect(receivedObj).not.toBeNull();
    expect(typeof receivedObj!.getAttribute).toBe("function");
    expect(typeof receivedObj!.getAttributeValue).toBe("function");
    expect(typeof receivedObj!.setAttributeValue).toBe("function");
    expect(typeof receivedObj!.setNotification).toBe("function");

    // Verify helper methods work correctly
    const attr = receivedObj!.getAttribute("FirstName");
    expect(attr).toBeDefined();
    expect(attr!.rules).toBe("MaxLength(50)");

    const value = receivedObj!.getAttributeValue("FirstName");
    expect(value).toBe("John");
});

test("checkRules receives attributes with rules from config", async () => {
    const service = new VirtualService();

    let receivedRules: string | undefined;

    class TestActions extends VirtualPersistentObjectActions {
        checkRules(obj: VirtualPersistentObject): boolean {
            const attr = obj.getAttribute("Email");
            receivedRules = attr?.rules;
            return super.checkRules(obj);
        }

        protected async saveNew(obj: VirtualPersistentObject): Promise<VirtualPersistentObject> {
            return obj;
        }
    }

    service.registerPersistentObject({
        type: "Person",
        label: "Person",
        stateBehavior: "StayInEdit",
        attributes: [
            {
                name: "Email",
                type: "String",
                rules: "NotEmpty; IsEmail",
                value: "test@example.com"
            }
        ]
    }, TestActions);

    await service.initialize();

    const person = await service.getPersistentObject(null, "Person", "1");
    await person.save();

    // Verify rules came from config
    expect(receivedRules).toBe("NotEmpty; IsEmail");
});
