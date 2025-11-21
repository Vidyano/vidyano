#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithUrls("http://localhost:44355")
    .WithDefaultAdmin()
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject($"Mock.{nameof(Mock_Attribute)}");
        po.StateBehavior = StateBehavior.OpenInEdit;

        // Configure ReadOnly variant
        var int32ReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.Int32ReadOnly));
        int32ReadOnly.IsReadOnly = true;

        // Configure Required variant
        var int32Required = po.GetOrCreateAttribute(nameof(Mock_Attribute.Int32Required));
        int32Required.AddRule("Required");

        // Configure Currency with unit before
        var decimalCurrency = po.GetOrCreateAttribute(nameof(Mock_Attribute.DecimalCurrency));
        decimalCurrency.DataTypeHints = "DisplayFormat=$ {0:0.##}";

        // Configure Weight with unit after
        var decimalWeight = po.GetOrCreateAttribute(nameof(Mock_Attribute.DecimalWeight));
        decimalWeight.DataTypeHints = "DisplayFormat={0:0.#} kg";
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    private static readonly List<Mock_Attribute> attributes = [];

    public MockContext()
    {
        Register(attributes);
    }

    public IQueryable<Mock_Attribute> Attributes => Query<Mock_Attribute>();

    public static Mock_Attribute GetOrCreateAttribute(string objectId)
    {
        var attribute = attributes.FirstOrDefault(a => a.Id == objectId);

        if (attribute == null)
        {
            attribute = new Mock_Attribute
            {
                Id = objectId,
                Int32 = Int32.MinValue,
                Int32ReadOnly = Int32.MinValue,
                Int32Required = 0,
                Decimal = 1234567890123.456789M,
                UInt64 = 1234567890123456789UL,
                Byte = 128,
                DecimalCurrency = 99.99M,
                DecimalWeight = 75.5M
            };
            attributes.Add(attribute);
        }

        return attribute;
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, object>(context)
{
    public override object? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    public Int32 Int32 { get; set; }

    public Int32 Int32ReadOnly { get; set; }

    public Int32 Int32Required { get; set; }

    public Decimal Decimal { get; set; }

    public UInt64 UInt64 { get; set; }

    public Byte Byte { get; set; }

    public Decimal DecimalCurrency { get; set; }

    public Decimal DecimalWeight { get; set; }
}
