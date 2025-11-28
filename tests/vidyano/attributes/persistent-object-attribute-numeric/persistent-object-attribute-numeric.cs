#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));
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
            attributes.Add(attribute = new Mock_Attribute { Id = objectId });

        return attribute;
    }

    public override void AddObject(PersistentObject obj, object entity)
    {
        if (entity is Mock_Attribute attribute)
            attribute.Id ??= (attributes.Count + 1).ToString();

        base.AddObject(obj, entity);
    }
}

public class MockWeb: CustomApiController
{
    public override void GetWebsiteContent(WebsiteArgs args)
    {
        base.GetWebsiteContent(args);

        var frontEndUrl = ServiceLocator.GetService<IConfiguration>()["frontend:url"];
        if (!string.IsNullOrEmpty(frontEndUrl))
            args.Contents = args.Contents.Replace("https://unpkg.com/@vidyano/vidyano/index.min.js", frontEndUrl);
    }
}

public class Mock_AttributeActions(MockContext context) : PersistentObjectActions<MockContext, Mock_Attribute>(context)
{
    public override Mock_Attribute? GetEntity(PersistentObject obj)
    {
        if (string.IsNullOrEmpty(obj.ObjectId))
            throw new ArgumentException("ObjectId cannot be null or empty", nameof(obj));

        return MockContext.GetOrCreateAttribute(obj.ObjectId);
    }
}

public class Mock_Attribute
{
    public string Id { get; set; } = null!;

    public Int32 Int32 { get; set; } = Int32.MinValue;

    public Int32 Int32ReadOnly { get; set; } = Int32.MinValue;

    public Int32 Int32Required { get; set; } = 0;

    public Decimal Decimal { get; set; } = 1234567890123.456789M;

    public UInt64 UInt64 { get; set; } = 1234567890123456789UL;

    public Byte Byte { get; set; } = 128;

    public Decimal DecimalCurrency { get; set; } = 99.99M;

    public Decimal DecimalWeight { get; set; } = 75.5M;
}
