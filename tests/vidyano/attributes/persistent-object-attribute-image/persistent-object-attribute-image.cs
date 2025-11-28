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

        // Configure Image attribute
        var image = po.GetOrCreateAttribute(nameof(Mock_Attribute.Image));
        image.DataType = "Image";

        // Configure ImageEmpty attribute
        var imageEmpty = po.GetOrCreateAttribute(nameof(Mock_Attribute.ImageEmpty));
        imageEmpty.DataType = "Image";

        // Configure ReadOnly variant
        var readOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.ImageReadOnly));
        readOnly.DataType = "Image";
        readOnly.IsReadOnly = true;

        // Configure Required variant
        var required = po.GetOrCreateAttribute(nameof(Mock_Attribute.ImageRequired));
        required.DataType = "Image";
        required.AddRule("Required");

        // Configure AllowPaste variant
        var allowPaste = po.GetOrCreateAttribute(nameof(Mock_Attribute.ImageAllowPaste));
        allowPaste.DataType = "Image";
        allowPaste.DataTypeHints = "AllowPaste=true";
    })
);

var app = builder.Build();

app.UseVidyano(app.Environment, app.Configuration);

app.Run();

public class MockContext : NullTargetContext
{
    // 1x1 black pixel PNG base64
    private const string BlackPixelBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR4AWNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==";

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
    // 1x1 black pixel PNG base64
    private const string BlackPixelBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR4AWNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==";

    public string Id { get; set; } = null!;

    public byte[]? Image { get; set; } = Convert.FromBase64String(BlackPixelBase64);

    public byte[]? ImageEmpty { get; set; } = null;

    public byte[]? ImageReadOnly { get; set; } = Convert.FromBase64String(BlackPixelBase64);

    public byte[]? ImageRequired { get; set; } = Convert.FromBase64String(BlackPixelBase64);

    public byte[]? ImageAllowPaste { get; set; } = Convert.FromBase64String(BlackPixelBase64);
}
