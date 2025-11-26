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

            var readOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.CommonMarkReadOnly));
            readOnly.IsReadOnly = true;
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
                CommonMark = "**Hello world!**",
                CommonMarkReadOnly = "**Read only content**",
                CommonMarkHeading = "# Test Heading",
                CommonMarkList = "- Item 1\n- Item 2\n- Item 3",
                CommonMarkLink = "[Example](https://example.com)"
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

    public string? CommonMark { get; set; }

    public string? CommonMarkReadOnly { get; set; }

    public string? CommonMarkHeading { get; set; }

    public string? CommonMarkList { get; set; }

    public string? CommonMarkLink { get; set; }
}
