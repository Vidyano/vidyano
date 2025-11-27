#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using Vidyano.Core.Services;
using Vidyano.Service;
using Vidyano.Service.Repository;

var builder = WebApplication.CreateBuilder(args);

builder.AddVidyanoMinimal<MockContext>(vidyano => vidyano
    .WithUrls("http://localhost:44355")
    .WithDefaultAdmin()
    .WithDefaultUser("Admin")
    .WithSchemaRights()
    .WithMenuItem(nameof(MockContext.Attributes))
    .WithModel(builder =>
    {
        var po = builder.GetOrCreatePersistentObject(nameof(Mock_Attribute));

        // Configure BinaryFile attribute
        var binaryFile = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFile));
        binaryFile.DataType = "BinaryFile";

        // Configure BinaryFileEmpty attribute
        var binaryFileEmpty = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileEmpty));
        binaryFileEmpty.DataType = "BinaryFile";

        // Configure ReadOnly variant
        var readOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileReadOnly));
        readOnly.DataType = "BinaryFile";
        readOnly.IsReadOnly = true;

        // Configure Required variant
        var required = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileRequired));
        required.DataType = "BinaryFile";
        required.AddRule("Required");

        // Configure Accept variant (images only)
        var acceptImages = po.GetOrCreateAttribute(nameof(Mock_Attribute.BinaryFileAcceptImages));
        acceptImages.DataType = "BinaryFile";
        acceptImages.DataTypeHints = "accept=image/*";
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

    public string? BinaryFile { get; set; } = "black-pixel.png|iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR4AWNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==";

    public string? BinaryFileEmpty { get; set; } = null;

    public string? BinaryFileReadOnly { get; set; } = "black-pixel.png|iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQAAAAA3bvkkAAAACklEQVR4AWNgAAAAAgABc3UBGAAAAABJRU5ErkJggg==";

    public string? BinaryFileRequired { get; set; } = "default.txt|ZGVmYXVsdA==";

    public string? BinaryFileAcceptImages { get; set; } = null;
}
