require 'spec_helper'
require_relative '../lodqa'

enjuURL = "http://bionlp.dbcls.jp/enju"
ontofinderURL = "http://ontofinder.dbcls.jp"

describe "LODQA", "error-handling in initialization method" do
  it "should handle bad enju url" do
    #qp = QueryParser.new
    expect { QueryParser.new("http://bionlp.dbcls.jp/enjuuuu", ontofinderURL, "semanticTypes.xml") }.to raise_error
  end
  it "should handle bad ontofind url" do
    expect { QueryParser.new(enjuURL, "http://ontofinder.dbcls.jpppp", "semanticTypes.xml") }.to raise_error
  end  
  it "should handle bad tuilookup xml file name" do
    expect { QueryParser.new(enjuURL, ontofinderURL, "semanticTypes.xmllll") }.to raise_error
  end
end

describe "LODQA", "error-handling on configuration" do
  it "should be able to handle a missing config file"
end

describe "LODQA", "error-handling in parse method" do
  it "should handle empty query" do
    qp = QueryParser.new(enjuURL, ontofinderURL, "semanticTypes.xml")
    expect { qp.parse("") }.to raise_error
  end  
  it "should handle null query" do
    qp = QueryParser.new(enjuURL, ontofinderURL, "semanticTypes.xml")
    nullQuery = nil
    expect { qp.parse(nullQuery) }.to raise_error
  end
end

describe "LODQA", "error-handling in get_query_with_bncs method" do
  it "should handle case where there are no base noun chunks" do
  # no need to check any return values here--we're just checking to see
  # that it doesn't crash in this case.
  # note that we picked the methods to call by taking a subset of the
  # ones that get called in lodqaWS.rb.
    qp = QueryParser.new(enjuURL, ontofinderURL, "semanticTypes.xml")
    qp.parse("big")
    qp.get_psparql
    qp.get_texps
  end
end

describe "LODQA", "error-handling in get_bncs method" do
  it "should handle case where there are no base noun chunks"
  # no need to check any return values here--we're just checking to see
  # that it doesn't crash in this case.
  # note that we picked the methods to call by taking a subset of the
  # ones that get called in lodqaWS.rb.
    qp = QueryParser.new(enjuURL, ontofinderURL, "semanticTypes.xml")
    qp.parse("big")
    qp.get_bncs
end

describe "LODQA", "error-handling in get_texps method" do
  it "should handle case where there is no content for the texps variable" 
end

describe "LODQA", "error-handling in get_psparql method" do
  it "should handle case where some of this has no content, but I'm not sure what yet" do
    qp = QueryParser.new(enjuURL, ontofinderURL, "semanticTypes.xml")
    qp.parse("What devices are used to treat heart failure?")
    qp.get_psparql.should eql ("SELECT ?t1\nWHERE {\n   ?t1 [:isa] [devices] . \n   ?t2 [:isa] [heart failure] . \n   ?t1 [used to treat] ?t2 . \n}") 
  end
end

describe "LODQA", "error-handling in get_sparql method" do
  it "should handle null vid"
  it "should handle empty vid"
  it "should handle invalid vid"
  it "should handle null acronym"
  it "should handle empty acronym"
end

describe "LODQA", "error-handling in find_term_uris method" do
  it "should handle null vid"
  it "should handle empty vid"
  it "should handle invalid vid"
end

describe "LODQA", "error-handling when using the command line" do
  it "should handle a missing semantic types file"
end

describe "LODQA", "basic functionality testing" do
  it "should handle good inputs when initialized"
  it "should handle valid queries to parser"
  it "should be able to look up existent terms given a good vid"
  it "should be able to take valid arguments from the command line"
  it "should be able to handle empty argument list from the command line"
  it "should handle a query that contains the word 'me'"
  it "should handle a query that does not contain the word 'me'" 
end
