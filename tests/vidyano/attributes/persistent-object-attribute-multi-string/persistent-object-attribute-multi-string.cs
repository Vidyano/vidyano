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

            var readOnlyAttr = po.GetOrCreateAttribute(nameof(Mock_Attribute.MultiStringReadOnly));
            readOnlyAttr.IsReadOnly = true;

            var tagsAttr = po.GetOrCreateAttribute(nameof(Mock_Attribute.MultiStringTags));
            tagsAttr.DataTypeHints = "inputtype=tags";

            var tagsOptionsAttr = po.GetOrCreateAttribute(nameof(Mock_Attribute.MultiStringTagsWithOptions));
            tagsOptionsAttr.DataTypeHints = "inputtype=tags";
            tagsOptionsAttr.DefaultOptions = "Option1\nOption2\nOption3";

            var tagsReadOnlyAttr = po.GetOrCreateAttribute(nameof(Mock_Attribute.MultiStringTagsReadOnly));
            tagsReadOnlyAttr.DataTypeHints = "inputtype=tags";
            tagsReadOnlyAttr.IsReadOnly = true;

            var triggersRefreshAttr = po.GetOrCreateAttribute(nameof(Mock_Attribute.MultiStringTriggersRefresh));
            triggersRefreshAttr.TriggersRefresh = true;
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

    public string? MultiString { get; set; } = "Item1\nItem2\nItem3";

    public string? MultiStringReadOnly { get; set; } = "ReadOnly1\nReadOnly2";

    public string? MultiStringTags { get; set; } = "Tag1\nTag2";

    public string? MultiStringTagsWithOptions { get; set; } = "Option1";

    public string? MultiStringTagsReadOnly { get; set; } = "Tag1\nTag2";

    public string? MultiStringTriggersRefresh { get; set; } = "Test line 1\nTest line 2";
}
