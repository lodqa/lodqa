require_relative '../lodqa'
require 'spec_helper'

# define various variables that you will pass to the methods that you're
# testing up here so that you don't have to define them over and over 
# again later.
@good_enju_url = "http://bionlp.dbcls.jp/enju"
@bad_enju_url = "http://bionlp.dbcls.jp/enjuuuuu"
@good_ontofind_url = "http://ontofinder.dbcls.jp"
@bad_ontofind_url = "http://ontofinderrrrrrr.dbcls.jp"
@good_tui_xml_filename = 'semanticTypes.xml'
@bad_tui_xml_filename = 'semanticTypesssss.xml'
@empty_query = ''
@null_query = nil
@valid_query = ''
@null_vid = nil
@empty_vid = ''
@good_vid = ''
@invalid_vid = 'ABCD'
   
describe "LODQA", "error-handling in initialization method" do
  it "should handle bad enju url" do
    #qp = QueryParser.new
    expect { QueryParser.new(@bad_enju_url, @good_ontofind_url, @good_tui_xml_filename) }.to raise_error
  end
  it "should handle bad ontofind url" do
    expect { QueryParser.new(@good_enju_url, @bad_ontofind_url, @good_tui_xml_filename) }.to raise_error
  end  
  it "should handle bad tuilookup xml file name" do
    expect { QueryParser.new(@good_enju_url, @good_ontofind_url, @bad_tui_xml_filename) }.to raise_error
  end
end

describe "LODQA", "error-handling on configuration" do
  it "should be able to handle a missing config file"
end

describe "LODQA", "error-handling in parse method" do
  it "should handle empty query" do
    qp = QueryParser.new(@good_enju_url, @good_ontofind_url, @good_tui_xml_filename)
    expect { qp.parse(@empty_query) }.to raise_error
  end  
  it "should handle null query" do
    qp = QueryParser.new(@good_enju_url, @good_ontofind_url, @good_tui_xml_filename)
    expect { qp.parse(@null_query) }.to raise_error
  end
end

describe "LODQA", "error-handling in get_query_with_bncs method" do
  it "should handle case where there are no base noun chunks"
end

describe "LODQA", "error-handling in get_bncs method" do
  it "should handle case where there are no base noun chunks"
end

describe "LODQA", "error-handling in get_texps method" do
  it "should handle case where there is no content for the texps variable" 
end

describe "LODQA", "error-handling in get_psparql method" do
  it "should handle case where some of this has no content, but I'm not sure what yet"
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
