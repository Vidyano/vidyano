#:sdk Microsoft.NET.Sdk.Web
#:property PublishAot=false
#:package Vidyano@6.0.*

using System.ComponentModel.DataAnnotations;
using Vidyano.Core.Services;
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

            var comboBox = po.GetOrCreateAttribute(nameof(Mock_Attribute.ComboBox));
            comboBox.DefaultOptions = "Option A\nOption B\nOption C";

            var comboBoxReadOnly = po.GetOrCreateAttribute(nameof(Mock_Attribute.ComboBoxReadOnly));
            comboBoxReadOnly.DefaultOptions = "Option A\nOption B\nOption C";
            comboBoxReadOnly.IsReadOnly = true;

            var comboBoxRequired = po.GetOrCreateAttribute(nameof(Mock_Attribute.ComboBoxRequired));
            comboBoxRequired.DefaultOptions = "\nOption A\nOption B\nOption C";
            comboBoxRequired.AddRule("Required");

            var comboBoxEmpty = po.GetOrCreateAttribute(nameof(Mock_Attribute.ComboBoxEmpty));
            comboBoxEmpty.DefaultOptions = "Option A\nOption B\nOption C";
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

    [DataType(DataTypes.ComboBox)]
    public string? ComboBox { get; set; } = "Option A";

    [DataType(DataTypes.ComboBox)]
    public string? ComboBoxReadOnly { get; set; } = "Option B";

    [DataType(DataTypes.ComboBox)]
    public string? ComboBoxRequired { get; set; } = "";

    [DataType(DataTypes.ComboBox)]
    public string? ComboBoxEmpty { get; set; } = null;
}
